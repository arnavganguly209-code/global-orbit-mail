import { generateKeyPairSync } from "node:crypto";
import type { DnsRecordStatus, DnsRecordType } from "@prisma/client";

const MAIL_HOST = process.env.MAIL_HOSTNAME ?? "mail.globalorbitmail.com";
const WEBMAIL_HOST = process.env.WEBMAIL_HOSTNAME ?? "webmail.globalorbitmail.cloud";
const AUTOCONFIG_HOST = process.env.AUTOCONFIG_HOSTNAME ?? WEBMAIL_HOST;
const MAIL_IPV4 = process.env.MAIL_SERVER_IPV4 ?? "0.0.0.0";

export type DnsRecordPurpose =
  | "mx"
  | "spf"
  | "dkim"
  | "dmarc"
  | "autodiscover"
  | "autoconfig"
  | "mail_a";

export type DnsRecordBlueprint = {
  type: DnsRecordType;
  /** Provider publish type (TXT for SPF/DKIM/DMARC). */
  publishType: "A" | "MX" | "TXT" | "CNAME";
  name: string;
  value: string;
  priority: number | null;
  status: DnsRecordStatus;
  ttl: number;
  purpose: DnsRecordPurpose;
  label: string;
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
    mailIpv4?: string;
  },
): DnsRecordBlueprint[] {
  const name = domainName.toLowerCase().replace(/\.$/, "");
  const mailHost = (options?.mailHost ?? MAIL_HOST).replace(/\.$/, "");
  const webmailHost = (options?.webmailHost ?? WEBMAIL_HOST).replace(/\.$/, "");
  const autoconfigHost = (process.env.AUTOCONFIG_HOSTNAME ?? AUTOCONFIG_HOST).replace(/\.$/, "");
  const mailIpv4 = options?.mailIpv4 ?? MAIL_IPV4;
  const selector = options?.dkimSelector ?? "orbit";
  const dkimValue =
    options?.dkimDnsValue ??
    "v=DKIM1; k=rsa; p=PENDING_GENERATE_ON_DOMAIN_CREATE";

  return [
    {
      type: "A",
      publishType: "A",
      name: `mail.${name}`,
      value: mailIpv4,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "mail_a",
      label: "A (mail)",
    },
    {
      type: "MX",
      publishType: "MX",
      name,
      value: `${mailHost}.`,
      priority: 10,
      status: "PENDING",
      ttl: 3600,
      purpose: "mx",
      label: "MX",
    },
    {
      type: "SPF",
      publishType: "TXT",
      name,
      value: `v=spf1 mx a:${mailHost} ~all`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "spf",
      label: "SPF",
    },
    {
      type: "DKIM",
      publishType: "TXT",
      name: `${selector}._domainkey.${name}`,
      value: dkimValue,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "dkim",
      label: "DKIM",
    },
    {
      type: "DMARC",
      publishType: "TXT",
      name: `_dmarc.${name}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${name}; ruf=mailto:dmarc@${name}; fo=1`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "dmarc",
      label: "DMARC",
    },
    {
      type: "CNAME",
      publishType: "CNAME",
      name: `autodiscover.${name}`,
      value: `${webmailHost}.`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "autodiscover",
      label: "Autodiscover",
    },
    {
      type: "CNAME",
      publishType: "CNAME",
      name: `autoconfig.${name}`,
      value: `${autoconfigHost}.`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "autoconfig",
      label: "Autoconfig",
    },
  ];
}

export type DnsInstructionRecord = {
  type: string;
  publishType: string;
  host: string;
  value: string;
  priority: number | null;
  ttl: number;
  status: string;
  purpose: string;
  label: string;
};

/** Public DNS instruction payload for Orbit UI / API consumers. */
export function toDnsInstructionJson(
  domainName: string,
  records: Array<{
    type: string;
    publishType?: string;
    name: string;
    value: string;
    priority: number | null;
    ttl: number;
    status: string;
    purpose?: string;
    label?: string;
  }>,
) {
  const formatted = records.map(formatRecord);
  const byPurpose = (purpose: string) => formatted.filter((r) => r.purpose === purpose);

  return {
    domain: domainName.toLowerCase(),
    generatedAt: new Date().toISOString(),
    mailHostname: MAIL_HOST,
    records: {
      a: byPurpose("mail_a"),
      mx: byPurpose("mx"),
      spf: byPurpose("spf"),
      dkim: byPurpose("dkim"),
      dmarc: byPurpose("dmarc"),
      autodiscover: byPurpose("autodiscover"),
      autoconfig: byPurpose("autoconfig"),
    },
    flat: formatted,
    instructions: {
      a: "Create an A record for mail.<domain> pointing to the Global Orbit mail server IP.",
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
  publishType?: string;
  name: string;
  value: string;
  priority: number | null;
  ttl: number;
  status: string;
  purpose?: string;
  label?: string;
}): DnsInstructionRecord {
  const purpose = record.purpose ?? inferPurpose(record);
  const publishType =
    record.publishType ??
    (["SPF", "DKIM", "DMARC"].includes(record.type.toUpperCase()) ? "TXT" : record.type);
  return {
    type: record.type,
    publishType,
    host: record.name,
    value: record.value,
    priority: record.priority,
    ttl: record.ttl,
    status: record.status,
    purpose,
    label: record.label ?? labelForPurpose(purpose),
  };
}

function inferPurpose(record: { type: string; name: string; value: string }): string {
  const type = record.type.toUpperCase();
  const name = record.name.toLowerCase();
  if (type === "A" || name.startsWith("mail.")) return "mail_a";
  if (type === "MX") return "mx";
  if (type === "SPF" || record.value.startsWith("v=spf1")) return "spf";
  if (type === "DKIM" || name.includes("._domainkey.")) return "dkim";
  if (type === "DMARC" || name.startsWith("_dmarc.")) return "dmarc";
  if (name.startsWith("autodiscover.")) return "autodiscover";
  if (name.startsWith("autoconfig.")) return "autoconfig";
  return "other";
}

function labelForPurpose(purpose: string) {
  switch (purpose) {
    case "mail_a":
      return "A (mail)";
    case "mx":
      return "MX";
    case "spf":
      return "SPF";
    case "dkim":
      return "DKIM";
    case "dmarc":
      return "DMARC";
    case "autodiscover":
      return "Autodiscover";
    case "autoconfig":
      return "Autoconfig";
    default:
      return purpose.toUpperCase();
  }
}

export function formatDnsRecordsForClipboard(
  records: Array<{
    type?: string;
    publishType?: string;
    label?: string;
    host?: string;
    name?: string;
    value: string;
    priority?: number | null;
  }>,
  domainName?: string,
) {
  const header = domainName ? `# DNS records for ${domainName}\n` : "";
  const lines = records.map((r) => {
    const host = r.host ?? r.name ?? "@";
    const kind = r.publishType ?? r.type ?? "TXT";
    const priority =
      r.priority != null && String(kind).toUpperCase() === "MX" ? `\t${r.priority}` : "";
    const label = r.label ? `# ${r.label}\n` : "";
    return `${label}${kind}\t${host}\t${r.value}${priority}`;
  });
  return `${header}${lines.join("\n\n")}`;
}

export function getMailHostname() {
  return MAIL_HOST;
}
