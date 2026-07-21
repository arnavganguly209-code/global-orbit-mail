import { generateKeyPairSync } from "node:crypto";
import type { DnsRecordStatus, DnsRecordType } from "@prisma/client";

const MAIL_HOST = process.env.MAIL_HOSTNAME ?? "mail.globalorbitmail.com";
const WEBMAIL_HOST = process.env.WEBMAIL_HOSTNAME ?? "webmail.globalorbitmail.cloud";
const AUTOCONFIG_HOST = process.env.AUTOCONFIG_HOSTNAME ?? WEBMAIL_HOST;

export type DnsRecordBlueprint = {
  type: DnsRecordType;
  name: string;
  value: string;
  priority: number | null;
  status: DnsRecordStatus;
  ttl: number;
  purpose: "mx" | "spf" | "dkim" | "dmarc" | "autodiscover" | "autoconfig" | "mail_a";
};

export type GeneratedDkimKey = {
  selector: string;
  publicKey: string;
  privateKeyPem: string;
  dnsValue: string;
};

/** Generate RSA-2048 DKIM keypair for a domain. */
export function generateDkimKeypair(selector = "orbit"): GeneratedDkimKey {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const publicKeyBody = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");

  const dnsValue = `v=DKIM1; k=rsa; p=${publicKeyBody}`;

  return {
    selector,
    publicKey: publicKeyBody,
    privateKeyPem: privateKey,
    dnsValue,
  };
}

export function buildDnsRecordsForDomain(
  domainName: string,
  options?: {
    dkimSelector?: string;
    dkimDnsValue?: string;
    mailHost?: string;
    webmailHost?: string;
  },
): DnsRecordBlueprint[] {
  const name = domainName.toLowerCase();
  const mailHost = options?.mailHost ?? MAIL_HOST;
  const webmailHost = options?.webmailHost ?? WEBMAIL_HOST;
  const autoconfigHost = process.env.AUTOCONFIG_HOSTNAME ?? AUTOCONFIG_HOST;
  const selector = options?.dkimSelector ?? "orbit";
  const dkimValue =
    options?.dkimDnsValue ??
    "v=DKIM1; k=rsa; p=PENDING_GENERATE_ON_DOMAIN_CREATE";

  return [
    {
      type: "MX",
      name,
      value: `10 ${mailHost}.`,
      priority: 10,
      status: "PENDING",
      ttl: 3600,
      purpose: "mx",
    },
    {
      type: "A",
      name: mailHost.includes(name) ? mailHost : `mail.${name}`,
      value: process.env.MAIL_SERVER_IPV4 ?? "0.0.0.0",
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "mail_a",
    },
    {
      type: "SPF",
      name,
      value: `v=spf1 mx a:${mailHost} ~all`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "spf",
    },
    {
      type: "DKIM",
      name: `${selector}._domainkey.${name}`,
      value: dkimValue,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "dkim",
    },
    {
      type: "DMARC",
      name: `_dmarc.${name}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${name}; ruf=mailto:dmarc@${name}; fo=1`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "dmarc",
    },
    {
      type: "CNAME",
      name: `autodiscover.${name}`,
      value: `${webmailHost}.`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "autodiscover",
    },
    {
      type: "CNAME",
      name: `autoconfig.${name}`,
      value: `${autoconfigHost}.`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "autoconfig",
    },
  ];
}

/** Public DNS instruction payload for Orbit UI / API consumers. */
export function toDnsInstructionJson(
  domainName: string,
  records: Array<{
    type: string;
    name: string;
    value: string;
    priority: number | null;
    ttl: number;
    status: string;
  }>,
) {
  const mx = records.filter((r) => r.type === "MX");
  const spf = records.filter((r) => r.type === "SPF" || (r.type === "TXT" && r.value.startsWith("v=spf1")));
  const dkim = records.filter((r) => r.type === "DKIM" || r.name.includes("._domainkey."));
  const dmarc = records.filter((r) => r.type === "DMARC" || r.name.startsWith("_dmarc."));
  const autodiscover = records.filter((r) => r.name.startsWith("autodiscover."));
  const autoconfig = records.filter((r) => r.name.startsWith("autoconfig."));

  return {
    domain: domainName.toLowerCase(),
    generatedAt: new Date().toISOString(),
    mailHostname: MAIL_HOST,
    records: {
      mx: mx.map(formatRecord),
      spf: spf.map(formatRecord),
      dkim: dkim.map(formatRecord),
      dmarc: dmarc.map(formatRecord),
      autodiscover: autodiscover.map(formatRecord),
      autoconfig: autoconfig.map(formatRecord),
      other: records
        .filter(
          (r) =>
            !mx.includes(r) &&
            !spf.includes(r) &&
            !dkim.includes(r) &&
            !dmarc.includes(r) &&
            !autodiscover.includes(r) &&
            !autoconfig.includes(r),
        )
        .map(formatRecord),
    },
    flat: records.map(formatRecord),
    instructions: {
      mx: "Point MX to the Global Orbit mail host with priority 10.",
      spf: "Publish the SPF TXT on the apex domain.",
      dkim: "Publish the DKIM TXT at selector._domainkey.",
      dmarc: "Publish the DMARC TXT at _dmarc.",
      autodiscover: "CNAME autodiscover to the webmail host (Outlook).",
      autoconfig: "CNAME autoconfig to the webmail host (Thunderbird).",
    },
  };
}

function formatRecord(record: {
  type: string;
  name: string;
  value: string;
  priority: number | null;
  ttl: number;
  status: string;
}) {
  return {
    type: record.type,
    host: record.name,
    value: record.value,
    priority: record.priority,
    ttl: record.ttl,
    status: record.status,
  };
}

export function getMailHostname() {
  return MAIL_HOST;
}
