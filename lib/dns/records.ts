/**
 * DNS record blueprints + instruction payload (no Node built-ins).
 * DKIM key generation lives in lib/dns/dkim.ts (server-only).
 */

import type { DnsRecordStatus, DnsRecordType } from "@prisma/client";

const MAIL_HOST = process.env.MAIL_HOSTNAME ?? "mail.globalorbitmail.com";
const WEBMAIL_HOST = process.env.WEBMAIL_HOSTNAME ?? "webmail.globalorbitmail.cloud";
const AUTOCONFIG_HOST = process.env.AUTOCONFIG_HOSTNAME ?? WEBMAIL_HOST;
const MAIL_IPV4 = process.env.MAIL_SERVER_IPV4 ?? "0.0.0.0";
const MAIL_IPV6 = process.env.MAIL_SERVER_IPV6 ?? "";

export type DnsRecordPurpose =
  | "mail_a"
  | "mail_aaaa"
  | "mx"
  | "spf"
  | "dkim"
  | "dmarc"
  | "autodiscover"
  | "autoconfig"
  | "imap"
  | "pop"
  | "smtp";

export type DnsRecordBlueprint = {
  type: DnsRecordType;
  /** Provider publish type shown in UI / clipboard. */
  publishType: "A" | "AAAA" | "MX" | "TXT" | "CNAME" | "SRV";
  name: string;
  value: string;
  priority: number | null;
  status: DnsRecordStatus;
  ttl: number;
  purpose: DnsRecordPurpose;
  label: string;
};

export function buildDnsRecordsForDomain(
  domainName: string,
  options?: {
    dkimSelector?: string;
    dkimDnsValue?: string;
    mailHost?: string;
    webmailHost?: string;
    mailIpv4?: string;
    mailIpv6?: string;
  },
): DnsRecordBlueprint[] {
  const name = domainName.toLowerCase().replace(/\.$/, "");
  const mailHost = (options?.mailHost ?? MAIL_HOST).replace(/\.$/, "");
  const webmailHost = (options?.webmailHost ?? WEBMAIL_HOST).replace(/\.$/, "");
  const autoconfigHost = (process.env.AUTOCONFIG_HOSTNAME ?? AUTOCONFIG_HOST).replace(/\.$/, "");
  const mailIpv4 = options?.mailIpv4 ?? MAIL_IPV4;
  const mailIpv6 = (options?.mailIpv6 ?? MAIL_IPV6).trim();
  const selector = options?.dkimSelector ?? "orbit";
  const dkimValue =
    options?.dkimDnsValue ??
    "v=DKIM1; k=rsa; p=PENDING_GENERATE_ON_DOMAIN_CREATE";

  const records: DnsRecordBlueprint[] = [
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
    {
      type: "TXT",
      publishType: "SRV",
      name: `_imap._tcp.${name}`,
      value: `0 1 993 ${mailHost}.`,
      priority: 0,
      status: "PENDING",
      ttl: 3600,
      purpose: "imap",
      label: "IMAP (SRV)",
    },
    {
      type: "TXT",
      publishType: "SRV",
      name: `_pop3._tcp.${name}`,
      value: `0 1 995 ${mailHost}.`,
      priority: 0,
      status: "PENDING",
      ttl: 3600,
      purpose: "pop",
      label: "POP3 (SRV)",
    },
    {
      type: "TXT",
      publishType: "SRV",
      name: `_submission._tcp.${name}`,
      value: `0 1 587 ${mailHost}.`,
      priority: 0,
      status: "PENDING",
      ttl: 3600,
      purpose: "smtp",
      label: "SMTP (SRV)",
    },
  ];

  if (mailIpv6) {
    records.splice(1, 0, {
      type: "AAAA",
      publishType: "AAAA",
      name: `mail.${name}`,
      value: mailIpv6,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "mail_aaaa",
      label: "AAAA (mail)",
    });
  }

  return records;
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
    title: "Required DNS Records",
    records: {
      a: byPurpose("mail_a"),
      aaaa: byPurpose("mail_aaaa"),
      mx: byPurpose("mx"),
      spf: byPurpose("spf"),
      dkim: byPurpose("dkim"),
      dmarc: byPurpose("dmarc"),
      autodiscover: byPurpose("autodiscover"),
      autoconfig: byPurpose("autoconfig"),
      imap: byPurpose("imap"),
      pop: byPurpose("pop"),
      smtp: byPurpose("smtp"),
    },
    flat: formatted,
    instructions: {
      a: "Create an A record for mail.<domain> pointing to the Global Orbit mail server IP.",
      aaaa: "Optional AAAA for mail.<domain> when IPv6 is enabled.",
      mx: "Point MX to the Global Orbit mail host with priority 10.",
      spf: "Publish the SPF TXT on the apex domain.",
      dkim: "Publish the DKIM TXT at selector._domainkey.",
      dmarc: "Publish the DMARC TXT at _dmarc.",
      autodiscover: "CNAME autodiscover to the webmail host (Outlook).",
      autoconfig: "CNAME autoconfig to the webmail host (Thunderbird).",
      imap: "SRV _imap._tcp for secure IMAP (993).",
      pop: "SRV _pop3._tcp for secure POP3 (995).",
      smtp: "SRV _submission._tcp for SMTP submission (587).",
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
  if (type === "AAAA") return "mail_aaaa";
  if (type === "A" || name.startsWith("mail.")) return "mail_a";
  if (type === "MX") return "mx";
  if (type === "SPF" || record.value.startsWith("v=spf1")) return "spf";
  if (type === "DKIM" || name.includes("._domainkey.")) return "dkim";
  if (type === "DMARC" || name.startsWith("_dmarc.")) return "dmarc";
  if (name.startsWith("autodiscover.")) return "autodiscover";
  if (name.startsWith("autoconfig.")) return "autoconfig";
  if (name.startsWith("_imap.")) return "imap";
  if (name.startsWith("_pop3.")) return "pop";
  if (name.startsWith("_submission.")) return "smtp";
  return "other";
}

function labelForPurpose(purpose: string) {
  switch (purpose) {
    case "mail_a":
      return "A (mail)";
    case "mail_aaaa":
      return "AAAA (mail)";
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
    case "imap":
      return "IMAP (SRV)";
    case "pop":
      return "POP3 (SRV)";
    case "smtp":
      return "SMTP (SRV)";
    default:
      return purpose.toUpperCase();
  }
}

export function getMailHostname() {
  return MAIL_HOST;
}
