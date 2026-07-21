import { prisma } from "@/lib/db";
import {
  buildDnsRecordsForDomain,
  normalizeApexDomain,
  toDnsInstructionJson,
} from "@/lib/dns/records";
import { generateDkimKeypair } from "@/lib/dns/dkim";
import { resolveMailServerIpv4, resolveMailServerIpv6 } from "@/lib/dns/mail-ip";
import { promises as dns } from "node:dns";

export { buildDnsRecordsForDomain, generateDkimKeypair, toDnsInstructionJson, normalizeApexDomain };

function toDbRecord(
  domainId: string,
  record: ReturnType<typeof buildDnsRecordsForDomain>[number],
) {
  const { purpose: _p, label: _l, publishType: _pt, host: _h, ...rest } = record;
  return { domainId, ...rest };
}

export async function provisionDnsForDomain(
  domainId: string,
  domainName: string,
  options?: { dkimSelector?: string; dkimDnsValue?: string },
) {
  const apex = normalizeApexDomain(domainName);
  const mailIpv4 = await resolveMailServerIpv4();
  const mailIpv6 = await resolveMailServerIpv6();
  const records = buildDnsRecordsForDomain(apex, {
    ...options,
    mailIpv4,
    mailIpv6,
  });

  await prisma.dnsRecord.createMany({
    data: records.map((record) => toDbRecord(domainId, record)),
  });

  await prisma.verification.createMany({
    data: [
      {
        kind: "DNS_MX",
        state: "PENDING",
        domainId,
        target: apex,
        detail: "Awaiting live MX verification",
      },
      {
        kind: "DNS_SPF",
        state: "PENDING",
        domainId,
        target: apex,
        detail: "Awaiting live SPF verification",
      },
      {
        kind: "DNS_DKIM",
        state: "PENDING",
        domainId,
        target: apex,
        detail: "Awaiting live DKIM verification",
      },
      {
        kind: "DNS_DMARC",
        state: "PENDING",
        domainId,
        target: apex,
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

async function markAlreadyPublished(
  apex: string,
  records: ReturnType<typeof buildDnsRecordsForDomain>,
) {
  return Promise.all(
    records.map(async (record) => {
      let alreadyPublished = false;
      try {
        if (record.publishType === "MX" || record.type === "MX") {
          const mx = await dns.resolveMx(apex);
          const expected = record.value.replace(/\.$/, "").toLowerCase();
          alreadyPublished = mx.some(
            (row) => row.exchange.replace(/\.$/, "").toLowerCase() === expected,
          );
        } else if (record.publishType === "A" || record.type === "A") {
          const addrs = await dns.resolve4(record.name);
          alreadyPublished = addrs.includes(record.value);
        } else if (record.publishType === "CNAME" || record.type === "CNAME") {
          const cnames = await dns.resolveCname(record.name);
          const expected = record.value.replace(/\.$/, "").toLowerCase();
          alreadyPublished = cnames.some(
            (row) => row.replace(/\.$/, "").toLowerCase() === expected,
          );
        } else if (
          record.publishType === "TXT" ||
          record.type === "TXT" ||
          record.type === "SPF" ||
          record.type === "DKIM" ||
          record.type === "DMARC"
        ) {
          const txts = await dns.resolveTxt(record.name);
          const flat = txts.map((parts) => parts.join(""));
          alreadyPublished = flat.some((txt) => txt.includes(record.value.slice(0, 24)));
        }
      } catch {
        alreadyPublished = false;
      }
      return { ...record, alreadyPublished };
    }),
  );
}

/**
 * Always return apex mail DNS instructions.
 * Never requires public DNS to exist first. Never emits www hosts or 0.0.0.0.
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

  const apex = normalizeApexDomain(domain.name);
  if (apex !== domain.name.toLowerCase()) {
    await prisma.domain.update({
      where: { id: domain.id },
      data: { name: apex },
    });
  }

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

  const mailIpv4 = await resolveMailServerIpv4();
  const mailIpv6 = await resolveMailServerIpv6();
  const generated = buildDnsRecordsForDomain(apex, {
    dkimSelector,
    dkimDnsValue,
    mailIpv4,
    mailIpv6,
  });

  // Replace stale/wrong DB rows (e.g. mail.www.*) with correct apex mail records.
  const hasWwwPollution = domain.dnsRecords.some(
    (r) => r.name.includes(".www.") || r.name.startsWith("www.") || r.value === "0.0.0.0",
  );
  if (domain.dnsRecords.length === 0 || hasWwwPollution) {
    if (hasWwwPollution) {
      await prisma.dnsRecord.updateMany({
        where: { domainId: domain.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }
    await prisma.dnsRecord.createMany({
      data: generated.map((record) => toDbRecord(domain.id, record)),
    });
  }

  const annotated = await markAlreadyPublished(apex, generated);

  return toDnsInstructionJson(
    apex,
    annotated.map((r) => ({
      type: r.type,
      publishType: r.publishType,
      name: r.name,
      host: r.host,
      value: r.value,
      priority: r.priority,
      ttl: r.ttl,
      status: r.alreadyPublished ? "DETECTED" : r.status,
      purpose: r.purpose,
      label: r.label,
      alreadyPublished: r.alreadyPublished,
    })),
  );
}
