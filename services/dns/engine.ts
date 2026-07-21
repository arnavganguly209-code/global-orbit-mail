import { prisma } from "@/lib/db";
import {
  buildDnsRecordsForDomain,
  generateDkimKeypair,
  toDnsInstructionJson,
} from "@/lib/dns/records";

export { buildDnsRecordsForDomain, generateDkimKeypair, toDnsInstructionJson };

export async function provisionDnsForDomain(
  domainId: string,
  domainName: string,
  options?: { dkimSelector?: string; dkimDnsValue?: string },
) {
  const records = buildDnsRecordsForDomain(domainName, options);
  await prisma.dnsRecord.createMany({
    data: records.map(({ purpose: _purpose, label: _label, publishType: _publishType, ...record }) => ({
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

/**
 * Always return the full generated DNS instruction set for a domain.
 * Does not require existing dns_records rows — generates from domain + DKIM material.
 * Persists DKIM keys and missing records so later Verify / Copy stay consistent.
 */
export async function getDomainDnsPayload(domainId: string) {
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, deletedAt: null },
    include: {
      dnsRecords: {
        where: { deletedAt: null },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!domain) return null;

  let dkimSelector = domain.dkimSelector?.trim() || "orbit";
  let dkimDnsValue: string | undefined;

  if (domain.dkimPublicKey?.trim()) {
    dkimDnsValue = `v=DKIM1; k=rsa; p=${domain.dkimPublicKey.trim()}`;
  } else {
    const existingDkim = domain.dnsRecords.find(
      (r) => r.type === "DKIM" || r.name.includes("._domainkey."),
    );
    if (existingDkim?.value?.includes("p=") && !existingDkim.value.includes("PENDING_GENERATE")) {
      dkimDnsValue = existingDkim.value;
      const selectorMatch = /^([^.]+)\._domainkey\./i.exec(existingDkim.name);
      if (selectorMatch?.[1]) dkimSelector = selectorMatch[1];
    } else {
      const dkim = generateDkimKeypair(dkimSelector);
      await prisma.domain.update({
        where: { id: domain.id },
        data: {
          dkimSelector: dkim.selector,
          dkimPublicKey: dkim.publicKey,
          dkimPrivateKey: dkim.privateKeyPem,
        },
      });
      dkimSelector = dkim.selector;
      dkimDnsValue = dkim.dnsValue;
    }
  }

  const generated = buildDnsRecordsForDomain(domain.name, {
    dkimSelector,
    dkimDnsValue,
  });

  // Persist generated records when the domain has none yet (Copy DNS / create gaps).
  if (domain.dnsRecords.length === 0) {
    await prisma.dnsRecord.createMany({
      data: generated.map(({ purpose: _p, label: _l, publishType: _pt, ...record }) => ({
        domainId: domain.id,
        ...record,
      })),
    });
  }

  return toDnsInstructionJson(
    domain.name,
    generated.map((r) => ({
      type: r.type,
      publishType: r.publishType,
      name: r.name,
      value: r.value,
      priority: r.priority,
      ttl: r.ttl,
      status: r.status,
      purpose: r.purpose,
      label: r.label,
    })),
  );
}
