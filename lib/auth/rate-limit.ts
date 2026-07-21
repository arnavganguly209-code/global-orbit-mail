/**
 * Login rate limiting & account lockout — PostgreSQL backed.
 * Keys off the account email (resolved from username or email at login).
 */

import { prisma } from "@/lib/db";
import {
  EMAIL_RATE_LIMIT_MAX,
  EMAIL_RATE_LIMIT_WINDOW_MS,
  IP_RATE_LIMIT_MAX,
  IP_RATE_LIMIT_WINDOW_MS,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
} from "@/lib/auth/constants";

export async function assertLoginAllowed(email: string, ipAddress?: string | null) {
  const normalized = email.toLowerCase().trim();
  const now = new Date();

  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { email: { equals: normalized, mode: "insensitive" } },
        { username: { equals: normalized, mode: "insensitive" } },
      ],
    },
    select: { id: true, lockedUntil: true, failedLoginCount: true },
  });

  if (user?.lockedUntil && user.lockedUntil > now) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
    throw new Error(`Account temporarily locked. Try again in ${minutes} minute(s).`);
  }

  const emailSince = new Date(now.getTime() - EMAIL_RATE_LIMIT_WINDOW_MS);
  const emailAttempts = await prisma.loginAttempt.count({
    where: {
      email: normalized,
      success: false,
      createdAt: { gte: emailSince },
    },
  });
  if (emailAttempts >= EMAIL_RATE_LIMIT_MAX) {
    throw new Error("Too many login attempts for this account. Please wait and try again.");
  }

  if (ipAddress) {
    const ipSince = new Date(now.getTime() - IP_RATE_LIMIT_WINDOW_MS);
    const ipAttempts = await prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: { gte: ipSince },
      },
    });
    if (ipAttempts >= IP_RATE_LIMIT_MAX) {
      throw new Error("Too many login attempts from this network. Please wait and try again.");
    }
  }
}

export async function recordLoginAttempt(input: {
  email: string;
  userId?: string | null;
  ipAddress?: string | null;
  success: boolean;
  reason?: string;
}) {
  const email = input.email.toLowerCase().trim();
  await prisma.loginAttempt.create({
    data: {
      email,
      ipAddress: input.ipAddress ?? null,
      success: input.success,
      reason: input.reason ?? null,
    },
  });

  const user =
    input.userId
      ? await prisma.user.findUnique({ where: { id: input.userId } })
      : await prisma.user.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { email: { equals: email, mode: "insensitive" } },
              { username: { equals: email, mode: "insensitive" } },
            ],
          },
        });

  if (!user) return;

  if (input.success) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    return;
  }

  const failedLoginCount = user.failedLoginCount + 1;
  const lockedUntil =
    failedLoginCount >= MAX_FAILED_LOGINS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
      : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount,
      lockedUntil,
    },
  });
}
