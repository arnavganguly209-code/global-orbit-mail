/**
 * Production admin login — Prisma User + bcrypt only.
 * Accepts Administrator ID as email OR username.
 */

import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { userRepository } from "@/repositories";
import {
  createDbSession,
  createSessionToken,
  sessionCookieOptions,
  sessionTtlSeconds,
  verifyPassword,
} from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { createCsrfToken, csrfCookieOptions, CSRF_COOKIE } from "@/lib/auth/csrf";
import { assertLoginAllowed, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { writeActivity, writeAudit } from "@/lib/audit";
import type { SystemRole } from "@/types";
import { isAdminRole, normalizeSystemRole } from "@/lib/auth/permissions";

const loginBodySchema = z.object({
  email: z.string().min(1).max(190),
  password: z.string().min(8).max(128),
  remember: z.boolean().optional().default(false),
});

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export async function adminLogin(request: Request) {
  const body = loginBodySchema.parse(await request.json());
  const identifier = body.email.trim();
  const password = body.password;
  const ipAddress = clientIp(request);
  const userAgent = request.headers.get("user-agent");

  // Resolve user by email OR username before rate-limit account lookup
  const user = await userRepository.findByLogin(identifier);
  const rateLimitKey = (user?.email ?? identifier).toLowerCase();

  await assertLoginAllowed(rateLimitKey, ipAddress);

  if (!user || !user.passwordHash) {
    await recordLoginAttempt({
      email: rateLimitKey,
      ipAddress,
      success: false,
      reason: "unknown_user",
    });
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }

  if (user.status !== "ACTIVE") {
    await recordLoginAttempt({
      email: user.email,
      userId: user.id,
      ipAddress,
      success: false,
      reason: "inactive",
    });
    throw Object.assign(new Error("Account is not active"), { status: 403 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordLoginAttempt({
      email: user.email,
      userId: user.id,
      ipAddress,
      success: false,
      reason: "bad_password",
    });
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }

  const role = (normalizeSystemRole(user.role?.key) ?? "MAILBOX_USER") as SystemRole;
  if (!isAdminRole(role)) {
    await recordLoginAttempt({
      email: user.email,
      userId: user.id,
      ipAddress,
      success: false,
      reason: "not_admin",
    });
    throw Object.assign(new Error("Admin access required"), { status: 403 });
  }

  const rememberMe = Boolean(body.remember);
  const token = await createSessionToken(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role,
      organizationId: user.organizationId,
      twoFactorEnabled: user.twoFactorEnabled,
    },
    rememberMe,
  );

  await createDbSession({
    userId: user.id,
    token,
    rememberMe,
    ipAddress,
    userAgent,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  await recordLoginAttempt({
    email: user.email,
    userId: user.id,
    ipAddress,
    success: true,
    reason: "ok",
  });

  await writeAudit({
    actorId: user.id,
    action: "auth.login",
    resource: "session",
    resourceId: user.id,
    ipAddress,
    userAgent,
    status: "SUCCESS",
    metadata: { rememberMe, surface: "orbit", via: identifier.includes("@") ? "email" : "username" },
  });

  await writeActivity({
    actorId: user.id,
    organizationId: user.organizationId,
    category: "auth",
    message: `${user.email} signed in to Orbit admin`,
    severity: "info",
  });

  const maxAge = sessionTtlSeconds(rememberMe);
  const csrfToken = createCsrfToken();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  jar.set(CSRF_COOKIE, csrfToken, csrfCookieOptions(maxAge));

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role,
      image: user.image,
      lastLoginAt: new Date().toISOString(),
    },
    csrfToken,
    expiresInSeconds: maxAge,
  };
}
