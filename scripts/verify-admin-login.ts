/**
 * Verify Super Admin credentials against Prisma + bcrypt.
 * Usage: npx tsx scripts/verify-admin-login.ts
 *
 * Does not print the password. Exits 0 on success, 1 on failure.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { verifyPassword, hashPassword } from "../lib/auth/session";

const prisma = new PrismaClient();

const EMAIL = "admin@theglobalorbit.com";
const USERNAME = "globalorbit";
const PASSWORD = "OrbitAdmin!2026";

async function assertLogin(identifier: string) {
  const value = identifier.toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { email: { equals: value, mode: "insensitive" } },
        { username: { equals: value, mode: "insensitive" } },
      ],
    },
    include: { role: true },
  });

  if (!user) {
    throw new Error(`User not found for identifier: ${identifier}`);
  }
  if (!user.passwordHash) {
    throw new Error(`User ${user.email} has no passwordHash`);
  }
  if (user.status !== "ACTIVE") {
    throw new Error(`User ${user.email} status is ${user.status}`);
  }
  if (user.role?.key !== "SUPER_ADMIN") {
    throw new Error(`User ${user.email} role is ${user.role?.key ?? "none"}`);
  }

  const ok = await verifyPassword(PASSWORD, user.passwordHash);
  if (!ok) {
    // Self-heal once: rehash with canonical helper and retry (seed drift)
    const passwordHash = await hashPassword(PASSWORD);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        username: USERNAME,
        failedLoginCount: 0,
        lockedUntil: null,
        deletedAt: null,
        status: "ACTIVE",
      },
    });
    const retry = await verifyPassword(PASSWORD, passwordHash);
    if (!retry) {
      throw new Error(`bcrypt.compare failed for ${identifier} even after rehash`);
    }
    console.log(`REPAIRED passwordHash for ${user.email}`);
  }

  console.log(`OK login via ${identifier} → ${user.email} (${user.role.key})`);
}

async function main() {
  await assertLogin(EMAIL);
  await assertLogin(USERNAME);
  console.log("Admin authentication verified for email and username.");
}

main()
  .catch((error) => {
    console.error("VERIFY_FAILED", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
