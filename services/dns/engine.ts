import { prisma } from "@/lib/db";
import { buildDnsRecordsForDomain } from "@/lib/dns/records";

export { buildDnsRecordsForDomain };

export async function provisionDnsForDomain(domainId: string, domainName: string) {
  const records = buildDnsRecordsForDomain(domainName);
  await prisma.dnsRecord.createMany({
    data: records.map((record) => ({
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
        detail: "MX verification architecture ready",
      },
      {
        kind: "DNS_SPF",
        state: "PENDING",
        domainId,
        target: domainName,
        detail: "SPF verification architecture ready",
      },
      {
        kind: "DNS_DKIM",
        state: "PENDING",
        domainId,
        target: domainName,
        detail: "DKIM verification architecture ready",
      },
      {
        kind: "DNS_DMARC",
        state: "PENDING",
        domainId,
        target: domainName,
        detail: "DMARC verification architecture ready",
      },
    ],
  });

  return prisma.dnsRecord.findMany({
    where: { domainId, deletedAt: null },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}
