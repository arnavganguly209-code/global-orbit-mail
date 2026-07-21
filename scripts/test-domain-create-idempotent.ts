/**
 * Idempotent domain create against the live DB (requires DATABASE_URL).
 * Usage: npx tsx scripts/test-domain-create-idempotent.ts
 */

import { PrismaClient } from "@prisma/client";
import { normalizeApexDomain } from "../lib/dns/domain-name";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.log("SKIP: no organization in database");
    return;
  }

  const inputs = [
    "zenspanp-qa-orbit.test",
    "www.zenspanp-qa-orbit.test",
    "https://zenspanp-qa-orbit.test",
    "HTTPS://WWW.ZENSPANP-QA-ORBIT.TEST/",
    " zenspanp-qa-orbit.test ",
  ];

  const apex = normalizeApexDomain(inputs[0]!);
  const before = await prisma.domain.count({
    where: {
      organizationId: org.id,
      OR: [{ name: apex }, { name: `www.${apex}` }],
    },
  });

  // Soft-clean prior QA rows
  await prisma.domain.deleteMany({
    where: {
      organizationId: org.id,
      OR: [{ name: apex }, { name: `www.${apex}` }],
    },
  });

  const { domainRepository } = await import("../repositories/domain.repository");

  const results = [];
  for (const input of inputs) {
    const result = await domainRepository.createOrGet({
      name: input,
      organizationId: org.id,
      actorId: null,
    });
    results.push({
      input,
      stored: result.domain.name,
      created: result.created,
      restored: result.restored,
      id: result.domain.id,
    });
  }

  const ids = new Set(results.map((r) => r.id));
  const rows = await prisma.domain.findMany({
    where: {
      organizationId: org.id,
      OR: [{ name: apex }, { name: `www.${apex}` }],
    },
  });

  console.log(JSON.stringify({ before, results, rowCount: rows.length, ids: [...ids] }, null, 2));

  if (ids.size !== 1) {
    throw new Error(`Expected one domain id, got ${ids.size}`);
  }
  if (rows.length !== 1) {
    throw new Error(`Expected one DB row, got ${rows.length}`);
  }
  if (rows[0]!.name !== apex) {
    throw new Error(`Expected stored name ${apex}, got ${rows[0]!.name}`);
  }
  if (results[0]!.created !== true) {
    throw new Error("First create should set created=true");
  }
  if (results.slice(1).some((r) => r.created)) {
    throw new Error("Subsequent creates must not create again");
  }

  console.log("Idempotent domain create tests passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
