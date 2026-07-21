/**
 * Resync all mailbox passwords into virtual_users (Dovecot passdb).
 * Usage (on VPS with DATABASE_URL): npx tsx scripts/resync-dovecot-auth.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS virtual_domains (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      active BOOLEAN NOT NULL DEFAULT true
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS virtual_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      domain TEXT NOT NULL,
      quota_bytes BIGINT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      home TEXT,
      uid INTEGER,
      gid INTEGER
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS home TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS uid INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS gid INTEGER`);
}

async function main() {
  await ensureTables();
  const base = (process.env.VMAIL_BASE ?? "/var/mail/vhosts").replace(/\/$/, "");
  const uid = Number(process.env.VMAIL_UID ?? "5000");
  const gid = Number(process.env.VMAIL_GID ?? "5000");

  const rows = await prisma.mailbox.findMany({
    where: { deletedAt: null, mailPasswordHash: { not: null } },
    include: { domain: true, quota: true },
  });

  let synced = 0;
  for (const row of rows) {
    const email = `${row.localPart}@${row.domain.name}`.toLowerCase();
    let password = row.mailPasswordHash!.trim();
    if (!password.startsWith("{")) password = `{BLF-CRYPT}${password}`;
    const domain = row.domain.name.toLowerCase();
    const home = `${base}/${domain}/${row.localPart.toLowerCase()}`;
    const quotaBytes = (row.quota?.quotaMb ?? 2048) * 1024 * 1024;

    await prisma.$executeRawUnsafe(
      `INSERT INTO virtual_domains (name, active) VALUES ($1, true)
       ON CONFLICT (name) DO UPDATE SET active = true`,
      domain,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO virtual_users (email, password, domain, quota_bytes, active, home, uid, gid)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
         password = EXCLUDED.password,
         quota_bytes = EXCLUDED.quota_bytes,
         active = true,
         home = EXCLUDED.home,
         uid = EXCLUDED.uid,
         gid = EXCLUDED.gid`,
      email,
      password,
      domain,
      quotaBytes,
      home,
      uid,
      gid,
    );
    synced += 1;
    console.log(`OK  ${email}  scheme=${password.slice(0, 11)}…  home=${home}`);
  }

  console.log(`\nSynced ${synced} mailbox(es) into virtual_users.`);
  console.log("Next: doveadm auth test user@domain.com 'password'");
  console.log("Ensure /etc/dovecot/dovecot-sql.conf.ext uses default_pass_scheme = BLF-CRYPT");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
