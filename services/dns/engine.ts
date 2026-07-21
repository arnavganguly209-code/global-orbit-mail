import { prisma } from "@/lib/db";
import { buildDnsRecordsForDomain, generateDkimKeypair, toDnsInstructionJson } from "@/lib/dns/records";

export { buildDnsRecordsForDomain, generateDkimKeypair, toDnsInstructionJson };

export async function provisionDnsForDomain(
  domainId: string,
  domainName: string,
  options?: { dkimSelector?: string; dkimDnsValue?: string },
) {
  const records = buildDnsRecordsForDomain(domainName, options);
  await prisma.dnsRecord.createMany({
    data: records.map(({ purpose: _purpose, ...record }) => ({
      domainId,
      ...record,
    })),
  });

  await prisma.verification.createMany({
    data: [
      {
        kind: "DNS_MX",
        state: "PENDING",
        domainId,
        target: domainName,
        detail: "Awaiting live MX verification",
      },
      {
        kind: "DNS_SPF",
        state: "PENDING",
        domainId,
        target: domainName,
        detail: "Awaiting live SPF verification",
      },
      {
        kind: "DNS_DKIM",
        state: "PENDING",
        domainId,
        target: domainName,
        detail: "Awaiting live DKIM verification",
      },
      {
        kind: "DNS_DMARC",
        state: "PENDING",
        domainId,
        target: domainName,
        detail: "Awaiting live DMARC verification",
      },
      {
        kind: "SSL",
        state: "PENDING",
        domainId,
        target: process.env.MAIL_HOSTNAME ?? "mail.globalorbitmail.com",
        detail: "Awaiting TLS check on mail host",
      },
    ],
  });

  return prisma.dnsRecord.findMany({
    where: { domainId, deletedAt: null },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function getDomainDnsPayload(domainId: string) {
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, deletedAt: null },
    include: { dnsRecords: { where: { deletedAt: null }, orderBy: [{ type: "asc" }, { name: "asc" }] } },
  });
  if (!domain) return null;
  return toDnsInstructionJson(
    domain.name,
    domain.dnsRecords.map((r) => ({
      type: r.type,
      name: r.name,
      value: r.value,
      priority: r.priority,
      ttl: r.ttl,
      status: r.status,
    })),
  );
}
