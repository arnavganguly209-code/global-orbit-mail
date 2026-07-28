/**
 * DNS record blueprints + instruction payload (no Node built-ins).
 * DKIM key generation: lib/dns/dkim.ts
 * Mail IP resolution: lib/dns/mail-ip.ts (server-only)
 */

import type { DnsRecordStatus, DnsRecordType } from "@prisma/client";
import {
  normalizeApexDomain,
  isValidApexDomain,
  domainLookupVariants,
} from "@/lib/dns/domain-name";
import {
  getConfiguredAutoconfigHostname,
  getConfiguredMailHostname,
  getConfiguredWebmailHostname,
} from "@/lib/dns/mail-host";

export { normalizeApexDomain, isValidApexDomain, domainLookupVariants };

export type DnsRecordPurpose =
  | "mail_a"
  | "mail_aaaa"
  | "mx"
  | "spf"
  | "verification"
  | "dkim"
  | "dmarc"
  | "autodiscover"
  | "autoconfig"
  | "imap"
  | "pop"
  | "smtp"
  | "caa";

export type DnsRecordBlueprint = {
  type: DnsRecordType;
  /** Provider publish type shown in UI / clipboard. */
  publishType: "A" | "AAAA" | "MX" | "TXT" | "CNAME" | "SRV" | "CAA";
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
  /** Cloudflare / CDN: must stay DNS-only (grey cloud). */
  proxyDnsOnly?: boolean;
};

function sharedMailHost() {
  return getConfiguredMailHostname();
}

function sharedWebmailHost() {
  return getConfiguredWebmailHostname();
}

function sharedAutoconfigHost() {
  return getConfiguredAutoconfigHostname();
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
      proxyDnsOnly: true,
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
      proxyDnsOnly: true,
    },
    {
      type: "SPF",
      publishType: "TXT",
      name: apex,
      host: "@",
      value: `v=spf1 mx a:${mailHost} ip4:${mailIpv4} -all`,
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
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${apex}; ruf=mailto:dmarc@${apex}; fo=1; adkim=r; aspf=r`,
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
      proxyDnsOnly: true,
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
      proxyDnsOnly: true,
    },
    {
      type: "TXT",
      publishType: "CAA",
      name: apex,
      host: "@",
      value: `0 issue "letsencrypt.org"`,
      priority: null,
      status: "PENDING",
      ttl: 3600,
      purpose: "caa",
      label: "CAA (optional)",
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
  tier?: "required" | "advanced";
  /** Cloudflare: grey-cloud / DNS only — never orange-proxy */
  proxyDnsOnly?: boolean;
};

export type SpfMergeRecommendation = {
  existing: string;
  recommended: string;
  message: string;
};

/** Production required — customer must publish these for Ready for Mail. */
export const REQUIRED_DNS_PURPOSES = [
  "mail_a",
  "mx",
  "spf",
  "dkim",
  "dmarc",
  "autodiscover",
  "autoconfig",
] as const;

export const ADVANCED_DNS_PURPOSES = [
  "caa",
  "imap",
  "pop",
  "smtp",
  "mail_aaaa",
  "verification",
] as const;

export function isRequiredDnsPurpose(purpose: string) {
  return (REQUIRED_DNS_PURPOSES as readonly string[]).includes(purpose);
}

export function isAdvancedDnsPurpose(purpose: string) {
  return (ADVANCED_DNS_PURPOSES as readonly string[]).includes(purpose);
}

/** Merge Orbit mail authorization into an existing SPF without replacing other includes. */
export function recommendSpfMerge(
  existingSpf: string,
  mailHost: string,
  mailIpv4?: string,
): SpfMergeRecommendation {
  const existing = existingSpf.trim().replace(/^"+|"+$/g, "");
  const tokens = [`a:${mailHost}`, ...(mailIpv4 ? [`ip4:${mailIpv4}`] : [])];
  const missing = tokens.filter(
    (token) => !existing.toLowerCase().includes(token.toLowerCase()),
  );
  if (/\bv=spf1\b/i.test(existing) && missing.length === 0) {
    return {
      existing,
      recommended: existing,
      message: "Existing SPF already authorizes Global Orbit Mail. No change needed.",
    };
  }

  let recommended = existing;
  if (!/\bv=spf1\b/i.test(recommended)) {
    recommended = `v=spf1 ${tokens.join(" ")} -all`;
  } else {
    const insert = missing.join(" ");
    if (/\s(~all|-all|\?all|\+all)\s*$/i.test(recommended)) {
      recommended = recommended.replace(/\s(~all|-all|\?all|\+all)\s*$/i, ` ${insert} $1`);
    } else {
      recommended = `${recommended} ${insert} -all`;
    }
  }

  return {
    existing,
    recommended: recommended.replace(/\s+/g, " ").trim(),
    message:
      "An SPF TXT already exists on @. Do not replace it — merge the recommended value so website and other services keep working.",
  };
}

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
  options?: {
    spfMerge?: SpfMergeRecommendation | null;
    verificationEnabled?: boolean;
    website?: {
      websiteSafe: boolean;
      hasWebsite: boolean;
      apexHasWebsite?: boolean;
      wwwHasWebsite?: boolean;
      wwwIsCname?: boolean;
      existingForeignMx?: boolean;
      foreignMxTargets?: string[];
      notes?: string[];
    } | null;
  },
) {
  const apex = normalizeApexDomain(domainName);
  const formatted = records.map((r) => {
    const row = formatRecord(r, apex);
    return {
      ...row,
      tier: isRequiredDnsPurpose(row.purpose) ? ("required" as const) : ("advanced" as const),
    };
  });

  // Production ordering: A → MX → SPF → DKIM → DMARC → Autodiscover → Autoconfig
  const requiredOrder = REQUIRED_DNS_PURPOSES;
  const required = requiredOrder
    .map((purpose) => formatted.find((r) => r.purpose === purpose))
    .filter((r): r is (typeof formatted)[number] => Boolean(r));
  const advanced = formatted
    .filter((r) => r.tier === "advanced")
    .sort((a, b) => {
      const order = ADVANCED_DNS_PURPOSES as readonly string[];
      return order.indexOf(a.purpose) - order.indexOf(b.purpose);
    });
  const byPurpose = (purpose: string) => formatted.filter((r) => r.purpose === purpose);

  const websiteSafe = options?.website?.websiteSafe !== false;
  const hasWebsite = Boolean(options?.website?.hasWebsite);
  const mailHost = sharedMailHost();

  return {
    domain: apex,
    generatedAt: new Date().toISOString(),
    mailHostname: mailHost,
    mailServerIpv4: byPurpose("mail_a")[0]?.value ?? null,
    title: "Connect your domain",
    notice:
      "Copy these production DNS records exactly. Keep Cloudflare proxy OFF (DNS only / grey cloud) on mail A and MX. Publish exactly ONE SPF TXT — never leave an old GoDaddy/Hostinger SPF alongside Orbit SPF (Gmail blocks with 550 5.7.26). Do not change www or root website DNS.",
    summary: {
      requiredRecords: required.length,
      estimatedSetupTime: "Under 5 minutes",
      websiteSafe: websiteSafe ? "YES" : "REVIEW",
      hasWebsite,
      style: "production-ready",
    },
    website: options?.website ?? {
      websiteSafe: true,
      hasWebsite: false,
      notes: ["Orbit never asks you to change www or root website records."],
    },
    providers: {
      oneClickStatus: "available_soon" as const,
      supported: ["hostinger", "cloudflare", "godaddy", "namecheap"] as const,
      message:
        "One-click DNS for Hostinger, Cloudflare, GoDaddy, and Namecheap is coming soon. Use Copy Required DNS today.",
    },
    wizard: {
      style: "production-ready",
      requiredCount: required.length,
      advancedCount: advanced.length,
      verificationEnabled: Boolean(options?.verificationEnabled),
      estimatedSetupTime: "Under 5 minutes",
      websiteSafe: websiteSafe ? "YES" : "REVIEW",
      cloudflareDnsOnly: true,
    },
    required,
    advanced,
    spfMerge: options?.spfMerge ?? null,
    records: {
      a: byPurpose("mail_a"),
      aaaa: byPurpose("mail_aaaa"),
      mx: byPurpose("mx"),
      spf: byPurpose("spf"),
      verification: byPurpose("verification"),
      dkim: byPurpose("dkim"),
      dmarc: byPurpose("dmarc"),
      autodiscover: byPurpose("autodiscover"),
      autoconfig: byPurpose("autoconfig"),
      caa: byPurpose("caa"),
      imap: byPurpose("imap"),
      pop: byPurpose("pop"),
      smtp: byPurpose("smtp"),
    },
    flat: formatted,
    instructions: {
      a: `Required: A Host mail → ${byPurpose("mail_a")[0]?.value ?? "MAIL_SERVER_IPV4"} (Cloudflare: DNS only / grey cloud).`,
      aaaa: "Optional AAAA for Host mail when IPv6 is enabled on the mail server.",
      mx: `Required: MX Host @ priority 10 → ${mailHost}. (never point MX at mail.${apex})`,
      spf: "Required: publish ONE SPF TXT on Host @ (merge if one already exists — never add a second SPF).",
      verification: "Optional ownership TXT used only when domain verification is enabled.",
      dkim: "Required: DKIM TXT on Host orbit._domainkey (Gmail/Outlook delivery).",
      dmarc: "Required: DMARC TXT on Host _dmarc (production quarantine policy).",
      autodiscover: `Required: CNAME Host autodiscover → ${sharedWebmailHost()}. (Outlook)`,
      autoconfig: `Required: CNAME Host autoconfig → ${sharedAutoconfigHost()}. (Thunderbird)`,
      caa: "Optional CAA on Host @ allowing Let's Encrypt.",
      imap: "Optional SRV Host _imap._tcp for IMAP 993.",
      pop: "Optional SRV Host _pop3._tcp for POP3 995.",
      smtp: "Optional SRV Host _submission._tcp for SMTP 587.",
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
    proxyDnsOnly?: boolean;
  },
  apex: string,
): DnsInstructionRecord {
  const purpose = record.purpose ?? inferPurpose(record);
  const publishType =
    record.publishType ??
    (["SPF", "DKIM", "DMARC"].includes(record.type.toUpperCase()) ? "TXT" : record.type);
  const fqdn = normalizeRecordFqdn(record.name, apex);
  const host = record.host ?? toRelativeHost(fqdn, apex);
  const proxyDnsOnly =
    record.proxyDnsOnly === true ||
    purpose === "mail_a" ||
    purpose === "mail_aaaa" ||
    purpose === "mx" ||
    purpose === "autodiscover" ||
    purpose === "autoconfig";

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
    proxyDnsOnly,
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
  if (record.value.startsWith("orbit-domain-verification=")) return "verification";
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
      return "Mail A";
    case "mail_aaaa":
      return "Mail AAAA";
    case "mx":
      return "MX";
    case "spf":
      return "SPF";
    case "verification":
      return "Verification TXT";
    case "dkim":
      return "DKIM";
    case "dmarc":
      return "DMARC";
    case "autodiscover":
      return "Autodiscover";
    case "autoconfig":
      return "Autoconfig";
    case "caa":
      return "CAA";
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
