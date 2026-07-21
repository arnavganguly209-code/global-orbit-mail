/**
 * Password scheme sanity checks for Dovecot BLF-CRYPT compatibility.
 * Usage: npx tsx scripts/test-mailbox-password-scheme.ts
 */

import { hashMailboxPassword } from "../services/provisioning/password";
import { verifyPassword } from "../lib/auth/session";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const plain = "OrbitTestPass!234";
  const { passwordHash, mailPasswordHash } = await hashMailboxPassword(plain);

  assert(passwordHash.startsWith("$2"), `expected bcrypt hash, got ${passwordHash.slice(0, 8)}`);
  assert(
    mailPasswordHash.startsWith("{BLF-CRYPT}$2"),
    `expected {BLF-CRYPT}$2…, got ${mailPasswordHash.slice(0, 20)}`,
  );
  assert(await verifyPassword(plain, passwordHash), "verify against passwordHash failed");
  assert(await verifyPassword(plain, mailPasswordHash), "verify against mailPasswordHash failed");

  console.log("OK  passwordHash   =", passwordHash.slice(0, 20) + "…");
  console.log("OK  mailPasswordHash =", mailPasswordHash.slice(0, 28) + "…");
  console.log("Password scheme tests passed (BLF-CRYPT / bcrypt).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
