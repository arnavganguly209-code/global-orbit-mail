/**
 * Isolated password-change flow against the database.
 * Creates a throwaway customer user, never logs secrets.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { hashPassword, verifyPassword } from "../lib/auth/session";
import { profileService } from "../services/auth/profile";
import { CURRENT_PASSWORD_INCORRECT } from "../lib/auth/password-policy";

const OLD_PASSWORD = "OldSecurePass1";
const NEW_PASSWORD = "NewSecurePass1";
const WRONG_PASSWORD = "WrongCurrent1x";

async function main() {
  const suffix = `${Date.now()}@orbit-pw-test.invalid`;
  const email = `pwchange-${suffix}`;
  const org = await prisma.organization.create({
    data: {
      name: `pw-test-${Date.now()}`,
      slug: `pw-test-${Date.now()}`,
      type: "CUSTOMER",
    },
  });
  const role = await prisma.role.findFirst({ where: { key: "CUSTOMER" } });
  if (!role) throw new Error("CUSTOMER role missing");

  const user = await prisma.user.create({
    data: {
      email,
      name: "PW Test",
      passwordHash: await hashPassword(OLD_PASSWORD),
      organizationId: org.id,
      roleId: role.id,
      status: "ACTIVE",
    },
  });

  const originalHash = user.passwordHash!;

  try {
    await assert.rejects(
      () =>
        profileService.changePassword(user.id, {
          currentPassword: WRONG_PASSWORD,
          newPassword: NEW_PASSWORD,
          confirmPassword: NEW_PASSWORD,
        }),
      (err: unknown) => err instanceof Error && err.message === CURRENT_PASSWORD_INCORRECT,
    );
    const afterWrong = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(afterWrong.passwordHash, originalHash);
    assert.equal(await verifyPassword(OLD_PASSWORD, afterWrong.passwordHash!), true);

    await assert.rejects(
      () =>
        profileService.changePassword(user.id, {
          currentPassword: OLD_PASSWORD,
          newPassword: NEW_PASSWORD,
          confirmPassword: "MismatchPass1",
        }),
      (err: unknown) => err instanceof Error,
    );
    const afterMismatch = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(afterMismatch.passwordHash, originalHash);

    await assert.rejects(
      () =>
        profileService.changePassword(user.id, {
          currentPassword: OLD_PASSWORD,
          newPassword: "",
          confirmPassword: "",
        }),
      (err: unknown) => err instanceof Error,
    );

    await assert.rejects(
      () =>
        profileService.changePassword(user.id, {
          currentPassword: OLD_PASSWORD,
          newPassword: OLD_PASSWORD,
          confirmPassword: OLD_PASSWORD,
        }),
      (err: unknown) => err instanceof Error,
    );
    const afterSame = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(afterSame.passwordHash, originalHash);

    const result = await profileService.changePassword(user.id, {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    assert.equal(result.changed, true);

    const afterOk = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.notEqual(afterOk.passwordHash, originalHash);
    assert.equal(await verifyPassword(OLD_PASSWORD, afterOk.passwordHash!), false);
    assert.equal(await verifyPassword(NEW_PASSWORD, afterOk.passwordHash!), true);

    console.log("password-change DB tests OK");
  } finally {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.activity.deleteMany({ where: { actorId: user.id } });
    await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.organization.delete({ where: { id: org.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main();
