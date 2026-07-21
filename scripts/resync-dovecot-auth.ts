/**
 * Resync mailbox SHA512-CRYPT hashes into MySQL mailserver.virtual_users.
 * Usage (with MAIL_MYSQL_* + DATABASE_URL): npx tsx scripts/resync-dovecot-auth.ts
 */

import { PrismaClient } from "@prisma/client";
import { normalizeSha512Crypt } from "../lib/mail/sha512-crypt";
import { upsertMysqlVirtualUser } from "../services/provisioning/mysql-mail-auth";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.mailbox.findMany({
    where: { deletedAt: null, mailPasswordHash: { not: null } },
    include: { domain: true },
  });

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const email = `${row.localPart}@${row.domain.name}`.toLowerCase();
    const hash = normalizeSha512Crypt(row.mailPasswordHash);
    if (!hash) {
      console.log(`SKIP ${email}  (mailPasswordHash is not SHA512-CRYPT — reset password in Orbit)`);
      skipped += 1;
      continue;
    }

    const result = await upsertMysqlVirtualUser({
      email,
      passwordHash: hash,
      domain: row.domain.name.toLowerCase(),
    });

    if (result.ok) {
      synced += 1;
      console.log(`OK   ${email}  → MySQL mailserver.virtual_users`);
    } else {
      failed += 1;
      console.log(`FAIL ${email}  ${result.error}`);
    }
  }

  console.log(`\nSynced ${synced}; skipped ${skipped}; failed ${failed}`);
  console.log("Next on VPS: doveadm auth test user@domain.com 'password'");
  console.log("Expected: passdb: user authenticated");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
