/**
 * Validate Orbit-generated DNS blueprints BEFORE showing them to customers.
 * Fail closed — never emit invalid / placeholder / proxied-looking mail DNS.
 */

import { isUsableIpv4, isUsableIpv6 } from "@/lib/dns/mail-ip";
import { getConfiguredMailHostname } from "@/lib/dns/mail-host";
import type { DnsRecordBlueprint } from "@/lib/dns/records";

export type DnsBlueprintValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function isValidSpf(value: string): boolean {
  const v = value.trim();
  if (!/^v=spf1\b/i.test(v)) return false;
  if ((v.match(/\bv=spf1\b/gi) ?? []).length !== 1) return false;
  // `-all` etc. are not "word" tokens — do not use \b around the leading hyphen
  if (!/(?:^|\s)(~all|-all|\?all|\+all)\s*$/i.test(v)) return false;
  return true;
}

function isValidDkim(value: string): boolean {
  const v = value.trim();
  if (!/^v=DKIM1\b/i.test(v)) return false;
  if (!/\bk=rsa\b/i.test(v)) return false;
  const p = v.match(/\bp=([A-Za-z0-9+/=]+)/);
  if (!p?.[1] || p[1].length < 32) return false;
  if (/PENDING_GENERATE/i.test(v)) return false;
  return true;
}

function isValidDmarc(value: string): boolean {
  const v = value.trim();
  if (!/^v=DMARC1\b/i.test(v)) return false;
  if (!/\bp=(none|quarantine|reject)\b/i.test(v)) return false;
  // rua/ruf optional — only valid when present as mailto:
  const rua = /\brua=([^;\s]+)/i.exec(v)?.[1];
  const ruf = /\bruf=([^;\s]+)/i.exec(v)?.[1];
  if (rua && !/^mailto:/i.test(rua)) return false;
  if (ruf && !/^mailto:/i.test(ruf)) return false;
  return true;
}

/**
 * Structural + production-policy checks on generated records.
 * Does not require live public DNS (that is verifyDomain).
 */
export function validateDnsBlueprints(
  apex: string,
  records: DnsRecordBlueprint[],
  options?: { mailIpv4?: string; mailHost?: string },
): DnsBlueprintValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mailHost = (options?.mailHost ?? getConfiguredMailHostname()).toLowerCase();
  const mailIpv4 = (options?.mailIpv4 ?? "").trim();

  const byPurpose = (p: string) => records.filter((r) => r.purpose === p);

  const mx = byPurpose("mx");
  if (mx.length !== 1) errors.push(`Expected exactly 1 MX record, got ${mx.length}`);
  else {
    const value = mx[0]!.value.replace(/\.$/, "").toLowerCase();
    if (mx[0]!.host !== "@") errors.push("MX host must be @");
    if (mx[0]!.priority !== 10) errors.push("MX priority must be 10");
    if (value !== mailHost) {
      errors.push(`MX must target ${mailHost}. (got ${mx[0]!.value})`);
    }
    if (value === `mail.${apex}` || value.endsWith(`.${apex}`)) {
      errors.push(
        "MX must NOT point at mail.<customer-domain> — use the shared Orbit mail host",
      );
    }
  }

  const spf = byPurpose("spf");
  if (spf.length !== 1) errors.push(`Expected exactly 1 SPF record, got ${spf.length}`);
  else if (!isValidSpf(spf[0]!.value)) {
    errors.push(`Invalid SPF syntax: ${spf[0]!.value}`);
  } else if (mailIpv4 && !spf[0]!.value.includes(`ip4:${mailIpv4}`)) {
    errors.push(`SPF must include ip4:${mailIpv4}`);
  }

  const dkim = byPurpose("dkim");
  if (dkim.length !== 1) errors.push(`Expected exactly 1 DKIM record, got ${dkim.length}`);
  else if (!isValidDkim(dkim[0]!.value)) {
    errors.push("Invalid DKIM value (missing v=DKIM1 / k=rsa / p= key)");
  }

  const dmarc = byPurpose("dmarc");
  if (dmarc.length !== 1) errors.push(`Expected exactly 1 DMARC record, got ${dmarc.length}`);
  else if (!isValidDmarc(dmarc[0]!.value)) {
    errors.push(`Invalid DMARC syntax: ${dmarc[0]!.value}`);
  }

  const mailA = byPurpose("mail_a");
  if (mailA.length !== 1) errors.push(`Expected exactly 1 mail A record, got ${mailA.length}`);
  else {
    if (mailA[0]!.host !== "mail") errors.push("Mail A host must be mail");
    if (!isUsableIpv4(mailA[0]!.value)) {
      errors.push(`Mail A must be a usable public IPv4 (got ${mailA[0]!.value})`);
    }
    if (mailIpv4 && mailA[0]!.value !== mailIpv4) {
      errors.push(`Mail A must be ${mailIpv4} (got ${mailA[0]!.value})`);
    }
  }

  const autodisc = byPurpose("autodiscover");
  if (autodisc.length !== 1) errors.push("Missing Autodiscover CNAME");
  const autoconf = byPurpose("autoconfig");
  if (autoconf.length !== 1) errors.push("Missing Autoconfig CNAME");

  for (const aaaa of byPurpose("mail_aaaa")) {
    if (!isUsableIpv6(aaaa.value)) {
      errors.push(`Invalid mail AAAA: ${aaaa.value}`);
    }
  }

  // Never allow apex website A / www
  for (const r of records) {
    if (r.host === "www" || r.name.startsWith("www.")) {
      errors.push(`Refusing www DNS record: ${r.name}`);
    }
    if (r.purpose === "mail_a" && r.host === "@") {
      errors.push("Refusing apex A as mail record (would break website)");
    }
  }

  // Duplicate SPF across purposes
  const spfLike = records.filter(
    (r) => r.purpose === "spf" || /^v=spf1\b/i.test(r.value),
  );
  if (spfLike.length > 1) {
    errors.push("Duplicate SPF records generated — only one SPF is allowed");
  }

  if (!mailHost.includes(".")) {
    errors.push(`Mail hostname looks invalid: ${mailHost}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
