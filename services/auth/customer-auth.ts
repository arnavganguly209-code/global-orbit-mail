/**
 * Customer (SaaS) auth service — signup + sign in for CUSTOMER role.
 * Mirrors services/auth/admin-login.ts but provisions an Organization
 * and scopes the session to SystemRole "CUSTOMER".
 */

import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createDbSession,
  createSessionToken,
  hashPassword,
  sessionCookieOptions,
  sessionTtlSeconds,
  verifyPassword,
} from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { createCsrfToken, csrfCookieOptions, CSRF_COOKIE } from "@/lib/auth/csrf";
import { assertLoginAllowed, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { writeActivity, writeAudit } from "@/lib/audit";

const signupBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  company: z.string().trim().min(1).max(160),
});

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueOrganizationSlug(base: string) {
  const seed = slugify(base) || "customer";
  let slug = seed;
  let attempt = 0;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.organization.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${seed}-${attempt}`;
  }
  return slug;
}

export async function customerSignup(request: Request) {
  const body = signupBodySchema.parse(await request.json());
  const email = body.email.toLowerCase().trim();
  const ipAddress = clientIp(request);
  const userAgent = request.headers.get("user-agent");

  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  if (existing) {
    throw Object.assign(new Error("An account with this email already exists"), {
      status: 409,
    });
  }

  const role = await prisma.role.findUnique({ where: { key: "CUSTOMER" } });
  if (!role) {
    throw new Error("Customer role is not seeded — run the database seed");
  }

  const passwordHash = await hashPassword(body.password);
  const slug = await uniqueOrganizationSlug(
    body.company || email.split("@")[0] || "customer",
  );

  const { user, organization } = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: body.company,
        slug,
        type: "CUSTOMER",
        status: "TRIAL",
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        name: body.name,
        passwordHash,
        status: "ACTIVE",
        emailVerified: null,
        roleId: role.id,
        organizationId: organization.id,
      },
    });

    return { user, organization };
  });

  await writeAudit({
    actorId: user.id,
    action: "auth.signup",
    resource: "user",
    resourceId: user.id,
    ipAddress,
    metadata: { email, company: body.company, surface: "customer" },
  });

  await writeActivity({
    actorId: user.id,
    organizationId: organization.id,
    category: "auth",
    message: `${email} created a GLOBAL ORBIT MAIL account for ${body.company}`,
    severity: "info",
  });

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: "CUSTOMER",
    organizationId: organization.id,
    twoFactorEnabled: false,
  });

  await createDbSession({ userId: user.id, token, ipAddress, userAgent });

  const maxAge = sessionTtlSeconds(false);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  jar.set(CSRF_COOKIE, createCsrfToken(), csrfCookieOptions(maxAge));

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: "CUSTOMER" as const,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
  };
}

export async function customerLogin(request: Request) {
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

  if (user.role?.key !== "CUSTOMER") {
    await recordLoginAttempt({
      email: identifier,
      ipAddress,
      success: false,
      reason: "not_customer",
    });
    throw Object.assign(
      new Error("This account does not have customer portal access"),
      { status: 403 },
    );
  }

  const rememberMe = Boolean(body.remember);
  const token = await createSessionToken(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: "CUSTOMER",
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

  await recordLoginAttempt({ email: identifier, ipAddress, success: true, reason: "ok" });

  await writeAudit({
    actorId: user.id,
    action: "auth.login",
    resource: "session",
    resourceId: user.id,
    ipAddress,
    metadata: { rememberMe, surface: "customer" },
  });

  await writeActivity({
    actorId: user.id,
    organizationId: user.organizationId,
    category: "auth",
    message: `${user.email} signed in to the customer dashboard`,
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
      role: "CUSTOMER" as const,
      image: user.image,
      lastLoginAt: new Date().toISOString(),
    },
    expiresInSeconds: maxAge,
  };
}
