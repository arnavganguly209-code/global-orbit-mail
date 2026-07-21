/**
 * DNS record blueprints + instruction payload (no Node built-ins).
 * DKIM key generation: lib/dns/dkim.ts
 * Mail IP resolution: lib/dns/mail-ip.ts (server-only)
 */

import type { DnsRecordStatus, DnsRecordType } from "@prisma/client";

const MAIL_HOST = process.env.MAIL_HOSTNAME ?? "mail.globalorbitmail.com";
const WEBMAIL_HOST = process.env.WEBMAIL_HOSTNAME ?? "webmail.globalorbitmail.cloud";
const AUTOCONFIG_HOST = process.env.AUTOCONFIG_HOSTNAME ?? WEBMAIL_HOST;

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
  /** Absolute FQDN used for verification / storage (never includes www). */
  name: string;
  /** Host field for DNS panels: @, mail, _dmarc, etc. */
  host: string;
  value: string;
  priority: number | null;
  status: DnsRecordStatus;
  ttl: number;
  purpose: DnsRecordPurpose;
  label: string;
};

/**
 * Normalize customer domain to email apex (root) zone.
 * Strips protocol, path, trailing dot, and leading www.
 * Never uses www for mail services.
 */
export function normalizeApexDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//i, "");
  value = value.replace(/[/?#].*$/, "");
  value = value.replace(/\.$/, "");
  value = value.replace(/^www\./i, "");
  // Guard nested www (www.www.example.com)
  while (value.startsWith("www.")) {
    value = value.slice(4);
  }
  return value;
}

export function getSharedMailHostname() {
  return normalizeApexDomain(MAIL_HOST.startsWith("mail.") ? MAIL_HOST : MAIL_HOST);
}

function sharedMailHost() {
  return (process.env.MAIL_HOSTNAME ?? MAIL_HOST).replace(/\.$/, "").replace(/^www\./i, "").toLowerCase();
}

function sharedWebmailHost() {
  return (process.env.WEBMAIL_HOSTNAME ?? WEBMAIL_HOST)
    .replace(/\.$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

function sharedAutoconfigHost() {
  return (process.env.AUTOCONFIG_HOSTNAME ?? AUTOCONFIG_HOST)
    .replace(/\.$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

/**
 * Build ONLY additional mail DNS records for the apex zone.
 * Never emits www / website records. Never uses placeholder IPs.
 */
export function buildDnsRecordsForDomain(
  domainName: string,
  options: {
    dkimSelector?: string;
    dkimDnsValue?: string;
    mailHost?: string;
    webmailHost?: string;
    /** Required production IPv4 — never 0.0.0.0 */
    mailIpv4: string;
    mailIpv6?: string | null;
  },
): DnsRecordBlueprint[] {
  const apex = normalizeApexDomain(domainName);
  if (!apex || !apex.includes(".")) {
    throw new Error("Invalid domain for DNS generation");
  }
  if (apex.startsWith("www.")) {
    throw new Error("Email DNS must use the root domain, not www");
  }

  const mailIpv4 = options.mailIpv4.trim();
  if (!mailIpv4 || mailIpv4 === "0.0.0.0" || mailIpv4 === "127.0.0.1") {
    throw new Error("Production mail server IPv4 is required (MAIL_SERVER_IPV4)");
  }

  const mailHost = normalizeApexDomain(options.mailHost ?? sharedMailHost());
  const webmailHost = normalizeApexDomain(options.webmailHost ?? sharedWebmailHost());
  const autoconfigHost = normalizeApexDomain(sharedAutoconfigHost());
  const selector = options.dkimSelector ?? "orbit";
  const dkimValue =
    options.dkimDnsValue ??
    "v=DKIM1; k=rsa; p=PENDING_GENERATE_ON_DOMAIN_CREATE";
  const mailIpv6 = (options.mailIpv6 ?? "").trim();

  const records: DnsRecordBlueprint[] = [
    {
      type: "A",
      publishType: "A",
      name: `mail.${apex}`,
      host: "mail",
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
      name: apex,
      host: "@",
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
      name: apex,
      host: "@",
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
      name: `${selector}._domainkey.${apex}`,
      host: `${selector}._domainkey`,
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
      name: `_dmarc.${apex}`,
      host: "_dmarc",
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${apex}; ruf=mailto:dmarc@${apex}; fo=1`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "dmarc",
      label: "DMARC",
    },
    {
      type: "CNAME",
      publishType: "CNAME",
      name: `autodiscover.${apex}`,
      host: "autodiscover",
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
      name: `autoconfig.${apex}`,
      host: "autoconfig",
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
      name: `_imap._tcp.${apex}`,
      host: "_imap._tcp",
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
      name: `_pop3._tcp.${apex}`,
      host: "_pop3._tcp",
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
      name: `_submission._tcp.${apex}`,
      host: "_submission._tcp",
      value: `0 1 587 ${mailHost}.`,
      priority: 0,
      status: "PENDING",
      ttl: 3600,
      purpose: "smtp",
      label: "SMTP (SRV)",
    },
  ];

  if (mailIpv6 && mailIpv6 !== "::" && mailIpv6 !== "::1") {
    records.splice(1, 0, {
      type: "AAAA",
      publishType: "AAAA",
      name: `mail.${apex}`,
      host: "mail",
      value: mailIpv6,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "mail_aaaa",
      label: "AAAA (mail)",
    });
  }

  // Hard safety: never emit www hosts
  for (const record of records) {
    if (record.name.includes(".www.") || record.name.startsWith("www.") || record.host.includes("www")) {
      throw new Error(`Refusing www mail DNS host: ${record.name}`);
    }
  }

  return records;
}

export type DnsInstructionRecord = {
  type: string;
  publishType: string;
  /** Relative host for DNS panels (@, mail, …) */
  host: string;
  /** Absolute FQDN without www */
  fqdn: string;
  value: string;
  priority: number | null;
  ttl: number;
  status: string;
  purpose: string;
  label: string;
  alreadyPublished?: boolean;
};

/** Public DNS instruction payload for Orbit UI / API consumers. */
export function toDnsInstructionJson(
  domainName: string,
  records: Array<{
    type: string;
    publishType?: string;
    name: string;
    host?: string;
    value: string;
    priority: number | null;
    ttl: number;
    status: string;
    purpose?: string;
    label?: string;
    alreadyPublished?: boolean;
  }>,
) {
  const apex = normalizeApexDomain(domainName);
  const formatted = records.map((r) => formatRecord(r, apex));
  const byPurpose = (purpose: string) => formatted.filter((r) => r.purpose === purpose);

  return {
    domain: apex,
    generatedAt: new Date().toISOString(),
    mailHostname: sharedMailHost(),
    title: "Required DNS Records",
    notice:
      "Add these mail DNS records at your DNS provider. Do not change existing website records (including www CNAME/A).",
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
      a: "Create an A record: Host mail → production mail server IPv4.",
      aaaa: "Optional AAAA for Host mail when IPv6 is enabled.",
      mx: "Create MX on Host @ (or apex domain) with priority 10.",
      spf: "Publish SPF TXT on Host @.",
      dkim: "Publish DKIM TXT on Host selector._domainkey.",
      dmarc: "Publish DMARC TXT on Host _dmarc.",
      autodiscover: "CNAME Host autodiscover → webmail host (Outlook).",
      autoconfig: "CNAME Host autoconfig → webmail host (Thunderbird).",
      imap: "SRV Host _imap._tcp for IMAP 993.",
      pop: "SRV Host _pop3._tcp for POP3 995.",
      smtp: "SRV Host _submission._tcp for SMTP 587.",
    },
  };
}

function formatRecord(
  record: {
    type: string;
    publishType?: string;
    name: string;
    host?: string;
    value: string;
    priority: number | null;
    ttl: number;
    status: string;
    purpose?: string;
    label?: string;
    alreadyPublished?: boolean;
  },
  apex: string,
): DnsInstructionRecord {
  const purpose = record.purpose ?? inferPurpose(record);
  const publishType =
    record.publishType ??
    (["SPF", "DKIM", "DMARC"].includes(record.type.toUpperCase()) ? "TXT" : record.type);
  const fqdn = normalizeRecordFqdn(record.name, apex);
  const host = record.host ?? toRelativeHost(fqdn, apex);

  return {
    type: record.type,
    publishType,
    host,
    fqdn,
    value: record.value,
    priority: record.priority,
    ttl: record.ttl,
    status: record.status,
    purpose,
    label: record.label ?? labelForPurpose(purpose),
    alreadyPublished: Boolean(record.alreadyPublished),
  };
}

function normalizeRecordFqdn(name: string, apex: string) {
  const cleaned = name.trim().toLowerCase().replace(/\.$/, "");
  if (cleaned === "@" || cleaned === "") return apex;
  if (cleaned.startsWith("www.")) {
    return cleaned.replace(/^www\./, "") === apex ? apex : normalizeApexDomain(cleaned);
  }
  if (cleaned.includes(".www.")) {
    return cleaned.replace(/\.www\./g, ".");
  }
  return cleaned;
}

function toRelativeHost(fqdn: string, apex: string) {
  if (fqdn === apex) return "@";
  if (fqdn.endsWith(`.${apex}`)) return fqdn.slice(0, -(apex.length + 1));
  return fqdn;
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
  return sharedMailHost();
}
