import assert from "node:assert/strict";
import {
  changePasswordBodySchema,
  CURRENT_PASSWORD_INCORRECT,
} from "../lib/auth/password-policy";
import { hashPassword, verifyPassword } from "../lib/auth/session";

async function main() {
  const parsedOk = changePasswordBodySchema.safeParse({
    currentPassword: "OldPassword1!",
    newPassword: "NewPassword1!",
    confirmPassword: "NewPassword1!",
  });
  assert.equal(parsedOk.success, true);

  const mismatch = changePasswordBodySchema.safeParse({
    currentPassword: "OldPassword1!",
    newPassword: "NewPassword1!",
    confirmPassword: "OtherPassword1!",
  });
  assert.equal(mismatch.success, false);

  const emptyNew = changePasswordBodySchema.safeParse({
    currentPassword: "OldPassword1!",
    newPassword: "",
    confirmPassword: "",
  });
  assert.equal(emptyNew.success, false);

  const sameAsOld = changePasswordBodySchema.safeParse({
    currentPassword: "SamePassword1!",
    newPassword: "SamePassword1!",
    confirmPassword: "SamePassword1!",
  });
  assert.equal(sameAsOld.success, false);

  const hash = await hashPassword("CorrectHorse1");
  assert.equal(await verifyPassword("CorrectHorse1", hash), true);
  assert.equal(await verifyPassword("WrongPassword1", hash), false);
  assert.equal(hash.startsWith("$2"), true);
  assert.equal(CURRENT_PASSWORD_INCORRECT.includes("incorrect"), true);

  console.log("password-change policy tests OK");
}

void main();
