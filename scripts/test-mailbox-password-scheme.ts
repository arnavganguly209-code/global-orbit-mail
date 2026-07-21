/**
 * Password scheme sanity checks.
 * Usage: npx tsx scripts/test-mailbox-password-scheme.ts
 */

import { hashMailboxPassword, hashSchemeLabel } from "../services/provisioning/password";
import { verifyPassword } from "../lib/auth/session";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const plain = "OrbitTestPass!234";
  const { passwordHash, mailPasswordHash } = await hashMailboxPassword(plain);

  assert(passwordHash.startsWith("$2"), `expected bcrypt app hash, got ${passwordHash.slice(0, 8)}`);
  assert(mailPasswordHash.length > 10, "mailPasswordHash empty");
  assert(await verifyPassword(plain, passwordHash), "verify against passwordHash failed");

  const scheme = hashSchemeLabel(mailPasswordHash);
  console.log("OK  passwordHash      =", passwordHash.slice(0, 20) + "…");
  console.log("OK  mailPasswordHash  =", mailPasswordHash.slice(0, 36) + "…");
  console.log("OK  detected scheme   =", scheme);
  console.log(
    "Note: On the mail VPS, mail-agent.sh re-hashes with doveadm pw against live Dovecot scheme.",
  );
  console.log("Password scheme tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
