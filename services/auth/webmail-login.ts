/**
 * Webmail sign-in — database-backed credential check for the webmail UI shell.
 * Any active platform identity may open the inbox shell; mailbox-level
 * IMAP/SMTP provisioning is deferred (no Postfix/Dovecot in this phase).
 */

import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
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

const loginBodySchema = z.object({
  email: z.string().min(3).max(190),
  password: z.string().min(8),
  remember: z.boolean().optional().default(false),
});

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export async function webmailLogin(request: Request) {
  const body = loginBodySchema.parse(await request.json());
  const identifier = body.email.toLowerCase().trim();
  const ipAddress = clientIp(request);
  const userAgent = request.headers.get("user-agent");

  await assertLoginAllowed(identifier, ipAddress);

  const user = await prisma.user.findFirst({
    where: { email: identifier, deletedAt: null },
    include: { role: true },
  });

  if (!user || !user.passwordHash) {
    await recordLoginAttempt({
      email: identifier,
      ipAddress,
      success: false,
      reason: "unknown_user",
    });
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }

  if (user.status !== "ACTIVE") {
    await recordLoginAttempt({
      email: identifier,
      ipAddress,
      success: false,
      reason: "inactive",
    });
    throw Object.assign(new Error("Account is not active"), { status: 403 });
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    await recordLoginAttempt({
      email: identifier,
      ipAddress,
      success: false,
      reason: "bad_password",
    });
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }

  const role = (user.role?.key ?? "MAILBOX_USER") as SystemRole;
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

  await createDbSession({ userId: user.id, token, rememberMe, ipAddress, userAgent });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  await recordLoginAttempt({ email: identifier, ipAddress, success: true, reason: "ok" });

  await writeAudit({
    actorId: user.id,
    action: "auth.login",
    resource: "session",
    resourceId: user.id,
    ipAddress,
    metadata: { rememberMe, surface: "webmail" },
  });

  await writeActivity({
    actorId: user.id,
    organizationId: user.organizationId,
    category: "auth",
    message: `${user.email} signed in to webmail`,
    severity: "info",
  });

  const maxAge = sessionTtlSeconds(rememberMe);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  jar.set(CSRF_COOKIE, createCsrfToken(), csrfCookieOptions(maxAge));

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
    },
    expiresInSeconds: maxAge,
  };
}
