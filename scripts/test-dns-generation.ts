/**
 * Production DNS generator tests (no DB required).
 * Required = mail A + MX + SPF + DKIM + DMARC + Autodiscover + Autoconfig.
 *
 * Usage: npx tsx scripts/test-dns-generation.ts
 */

import {
  ADVANCED_DNS_PURPOSES,
  REQUIRED_DNS_PURPOSES,
  buildDnsRecordsForDomain,
  buildDmarcValue,
  buildSpfValue,
  getMailHostname,
  normalizeApexDomain,
  recommendSpfMerge,
  toDnsInstructionJson,
} from "../lib/dns/records";
import { validateDnsBlueprints } from "../lib/dns/validate-blueprint";
import { buildOneClickDnsPlan, DNS_PROVIDERS } from "../lib/dns/providers";

const CASES = [
  "zenspanp.com",
  "www.zenspanp.com",
  "https://www.zenspanp.com/path",
  "theglobalorbit.com",
  "www.theglobalorbit.com",
  "example.com",
  "www.example.com",
];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function main() {
  process.env.MAIL_HOSTNAME = "mail.globalorbitmail.cloud";
  process.env.MAIL_SERVER_IPV4 = "200.97.170.235";

  const mailIpv4 = process.env.MAIL_SERVER_IPV4!;
  const mailHost = getMailHostname();

  assert(mailHost === "mail.globalorbitmail.cloud", `unexpected mail host ${mailHost}`);
  assert(
    REQUIRED_DNS_PURPOSES.join(",") ===
      "mail_a,mx,spf,dkim,dmarc,autodiscover,autoconfig",
    `required purposes wrong: ${REQUIRED_DNS_PURPOSES.join(",")}`,
  );
  assert(
    (ADVANCED_DNS_PURPOSES as readonly string[]).includes("caa"),
    "caa must be advanced/optional",
  );
  assert(
    (REQUIRED_DNS_PURPOSES as readonly string[]).includes("mail_a"),
    "mail_a must be required",
  );

  for (const input of CASES) {
    const apex = normalizeApexDomain(input);
    assert(!apex.startsWith("www."), `apex still has www for ${input} → ${apex}`);

    const records = buildDnsRecordsForDomain(input, {
      mailIpv4,
      dkimDnsValue: "v=DKIM1; k=rsa; p=TESTPUBLICKEYTESTPUBLICKEYTESTPUBLICKEY12",
    });

    const validation = validateDnsBlueprints(apex, records, { mailIpv4, mailHost });
    assert(validation.ok, `blueprint invalid for ${apex}: ${validation.errors.join("; ")}`);

    const payload = toDnsInstructionJson(apex, records, {
      website: {
        websiteSafe: true,
        hasWebsite: input.includes("theglobalorbit") || input.includes("zenspanp"),
        wwwIsCname: input.includes("www."),
        notes: ["test"],
      },
    });

    const mx = records.find((r) => r.purpose === "mx");
    const spf = records.find((r) => r.purpose === "spf");
    const dkim = records.find((r) => r.purpose === "dkim");
    const mailA = records.find((r) => r.purpose === "mail_a");
    const dmarc = records.find((r) => r.purpose === "dmarc");

    assert(mx?.host === "@", "MX host must be @");
    assert(mx?.priority === 10, "MX priority must be 10");
    assert(mx?.value === `${mailHost}.`, `MX must point to ${mailHost}., got ${mx?.value}`);
    assert(
      spf?.value === `v=spf1 mx a:${mailHost} ip4:${mailIpv4} -all`,
      `SPF mismatch: ${spf?.value}`,
    );
    assert(Boolean(dkim?.value.includes("p=TESTPUBLICKEY")), "DKIM missing public key");
    assert(mailA?.value === mailIpv4, `mail A must be ${mailIpv4}, got ${mailA?.value}`);
    assert(mailA?.proxyDnsOnly === true, "mail A must be DNS-only");
    assert(mx?.proxyDnsOnly === true, "MX must be DNS-only");
    assert(Boolean(dmarc?.value.includes("v=DMARC1")), "DMARC missing");
    assert(Boolean(dmarc?.value.includes("p=quarantine")), "DMARC policy missing");
    assert(
      !dmarc?.value.includes("rua=") && !dmarc?.value.includes("ruf="),
      "DMARC must omit rua/ruf when no reporting mailbox",
    );
    assert(!records.some((r) => r.value.includes("mail.globalorbitmail.com")), ".com mail host leaked");

    assert(!records.some((r) => r.host === "www"), `www host leaked for ${input}`);
    assert(
      !records.some((r) => r.purpose === "mail_a" && r.host === "@"),
      `apex website A leaked for ${input}`,
    );
    assert(!payload.flat.some((r) => r.fqdn.startsWith("www.")), `www FQDN leaked for ${input}`);

    assert(payload.required.length === 7, `expected exactly 7 required for ${input}`);
    assert(
      payload.required.every((r) =>
        ["mail_a", "mx", "spf", "dkim", "dmarc", "autodiscover", "autoconfig"].includes(
          r.purpose,
        ),
      ),
      `required set wrong for ${input}`,
    );
    assert(payload.required[0]?.purpose === "mail_a", "first required must be mail A");
    assert(payload.required[1]?.purpose === "mx", "second required must be MX");

    // Exactly one SPF
    assert(
      records.filter((r) => r.purpose === "spf").length === 1,
      "duplicate SPF generated",
    );

    console.log(`OK  ${input} → ${apex} (${payload.required.length} required)`);
  }

  // SPF merge keeps a single record
  const merge = recommendSpfMerge(
    "v=spf1 include:_spf.google.com ~all",
    mailHost,
    mailIpv4,
  );
  assert(merge.recommended.includes(`a:${mailHost}`), "merge missing a:mail host");
  assert(merge.recommended.includes(`ip4:${mailIpv4}`), "merge missing ip4");
  assert((merge.recommended.match(/\bv=spf1\b/gi) ?? []).length === 1, "merged SPF not single");

  assert(DNS_PROVIDERS.length >= 4, "providers missing");
  const plan = buildOneClickDnsPlan("manual", "example.com", [
    {
      type: "MX",
      publishType: "MX",
      host: "@",
      value: "mail.globalorbitmail.cloud.",
      priority: 10,
      ttl: 3600,
    },
  ]);
  assert(Boolean(plan), "one-click plan missing");

  // Reject bad MX pointing at customer mail host
  const bad = buildDnsRecordsForDomain("evil.com", {
    mailIpv4,
    mailHost: "mail.evil.com",
    dkimDnsValue: "v=DKIM1; k=rsa; p=TESTPUBLICKEYTESTPUBLICKEYTESTPUBLICKEY12",
  });
  // Override after build by validating against shared host
  const badCheck = validateDnsBlueprints("evil.com", bad, {
    mailIpv4,
    mailHost: "mail.globalorbitmail.cloud",
  });
  assert(!badCheck.ok, "must reject MX that is not shared Orbit host");

  const spfBuilt = buildSpfValue(mailHost, mailIpv4);
  assert(spfBuilt.includes(`a:${mailHost}`), "SPF must use active mail host");
  assert(spfBuilt.includes(`ip4:${mailIpv4}`), "SPF must use active mail IPv4");

  const dmarcBare = buildDmarcValue();
  assert(!dmarcBare.includes("rua="), "bare DMARC must omit rua");
  const dmarcWith = buildDmarcValue({ reportingEmail: "postmaster@example.com" });
  assert(dmarcWith.includes("rua=mailto:postmaster@example.com"), "DMARC rua missing");
  assert(dmarcWith.includes("ruf=mailto:postmaster@example.com"), "DMARC ruf missing");

  const withReport = buildDnsRecordsForDomain("example.com", {
    mailIpv4,
    dkimDnsValue: "v=DKIM1; k=rsa; p=TESTPUBLICKEYTESTPUBLICKEYTESTPUBLICKEY12",
    dmarcReportingEmail: "postmaster@example.com",
  });
  assert(
    withReport.find((r) => r.purpose === "dmarc")?.value.includes("rua=mailto:postmaster@example.com"),
    "generated DMARC should use existing reporting mailbox",
  );

  console.log("\nAll DNS generation tests passed.");
}

main();
