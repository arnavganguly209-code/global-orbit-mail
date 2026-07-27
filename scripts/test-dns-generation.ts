/**
 * Commercial DNS generator + tier tests (no DB required).
 * Covers: fresh domain, website-safe rules, required = MX/SPF/DKIM only.
 *
 * Usage: npx tsx scripts/test-dns-generation.ts
 */

import {
  ADVANCED_DNS_PURPOSES,
  REQUIRED_DNS_PURPOSES,
  buildDnsRecordsForDomain,
  getMailHostname,
  normalizeApexDomain,
  recommendSpfMerge,
  toDnsInstructionJson,
} from "../lib/dns/records";
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
    REQUIRED_DNS_PURPOSES.join(",") === "mx,spf,dkim",
    `required purposes wrong: ${REQUIRED_DNS_PURPOSES.join(",")}`,
  );
  assert(
    (ADVANCED_DNS_PURPOSES as readonly string[]).includes("dmarc"),
    "dmarc must be advanced",
  );
  assert(
    (ADVANCED_DNS_PURPOSES as readonly string[]).includes("mail_a"),
    "mail_a must be advanced (shared MX model)",
  );
  assert(
    !(REQUIRED_DNS_PURPOSES as readonly string[]).includes("mail_a"),
    "mail_a must not be required",
  );

  for (const input of CASES) {
    const apex = normalizeApexDomain(input);
    assert(!apex.startsWith("www."), `apex still has www for ${input} → ${apex}`);

    const records = buildDnsRecordsForDomain(input, {
      mailIpv4,
      dkimDnsValue: "v=DKIM1; k=rsa; p=TESTPUBLICKEY",
    });
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

    assert(mx?.host === "@", "MX host must be @");
    assert(mx?.value === `${mailHost}.`, `MX must point to ${mailHost}., got ${mx?.value}`);
    assert(
      spf?.value === `v=spf1 mx a:${mailHost} ip4:${mailIpv4} -all`,
      `SPF mismatch: ${spf?.value}`,
    );
    assert(Boolean(dkim?.value.includes("p=TESTPUBLICKEY")), "DKIM missing public key");
    assert(mailA?.value === mailIpv4, `mail A must be ${mailIpv4}, got ${mailA?.value}`);
    assert(!records.some((r) => r.value.includes("mail.globalorbitmail.com")), ".com mail host leaked");

    // Never emit website-replacing records
    assert(!records.some((r) => r.host === "www"), `www host leaked for ${input}`);
    assert(
      !records.some((r) => r.purpose === "mail_a" && r.host === "@"),
      `apex website A leaked for ${input}`,
    );
    assert(!payload.flat.some((r) => r.fqdn.startsWith("www.")), `www FQDN leaked for ${input}`);

    assert(payload.required.length === 3, `expected exactly 3 required for ${input}`);
    assert(
      payload.required.every((r) => ["mx", "spf", "dkim"].includes(r.purpose)),
      `non-commercial purpose in required for ${input}: ${payload.required.map((r) => r.purpose).join(",")}`,
    );
    assert(
      payload.required.map((r) => r.purpose).join(",") === "mx,spf,dkim",
      `required order must be mx,spf,dkim for ${input}`,
    );
    assert(
      payload.advanced.every((r) => !["mx", "spf", "dkim"].includes(r.purpose)),
      `required purpose leaked into advanced for ${input}`,
    );
    assert(payload.summary?.requiredRecords === 3, "summary.requiredRecords must be 3");
    assert(payload.summary?.websiteSafe === "YES", "summary.websiteSafe must be YES");
    assert(
      payload.summary?.estimatedSetupTime === "Under 2 minutes",
      "summary setup time mismatch",
    );

    console.log(
      `OK  ${input.padEnd(36)} → required=${payload.required.map((r) => r.purpose).join(",")} advanced=${payload.advanced.length}`,
    );
  }

  // Existing SPF merge (website-safe)
  const merge = recommendSpfMerge(
    "v=spf1 include:_spf.google.com ~all",
    mailHost,
    mailIpv4,
  );
  assert(merge.recommended.includes(`a:${mailHost}`), "SPF merge missing mail host");
  assert(merge.recommended.includes(`ip4:${mailIpv4}`), "SPF merge missing ip4");
  assert(merge.recommended.includes("include:_spf.google.com"), "SPF merge dropped existing include");
  console.log("OK  SPF merge recommendation (existing website / Google SPF)");

  // Existing MX scenario — payload still only asks for our MX in required (customer replaces when ready)
  const foreignMxPayload = toDnsInstructionJson(
    "example.com",
    buildDnsRecordsForDomain("example.com", {
      mailIpv4,
      dkimDnsValue: "v=DKIM1; k=rsa; p=TEST",
    }),
    {
      website: {
        websiteSafe: true,
        hasWebsite: true,
        existingForeignMx: true,
        foreignMxTargets: ["10 mx.google.com"],
        notes: ["Foreign MX detected"],
      },
    },
  );
  assert(foreignMxPayload.required.length === 3, "foreign MX case still 3 required");
  assert(foreignMxPayload.website?.existingForeignMx === true, "foreign MX flag missing");
  console.log("OK  existing foreign MX scenario");

  // Cloudflare-style www CNAME — never suggest www changes
  const cfPayload = toDnsInstructionJson(
    "example.com",
    buildDnsRecordsForDomain("example.com", {
      mailIpv4,
      dkimDnsValue: "v=DKIM1; k=rsa; p=TEST",
    }),
    {
      website: {
        websiteSafe: true,
        hasWebsite: true,
        wwwIsCname: true,
        wwwHasWebsite: true,
        notes: ["www CNAME detected"],
      },
    },
  );
  assert(cfPayload.summary?.websiteSafe === "YES", "CF www must stay website-safe");
  assert(!cfPayload.flat.some((r) => r.host === "www"), "must not emit www record");
  console.log("OK  Cloudflare www CNAME scenario");

  // Provider future architecture
  assert(DNS_PROVIDERS.some((p) => p.id === "cloudflare"), "cloudflare provider stub missing");
  const plan = buildOneClickDnsPlan("cloudflare", "example.com", foreignMxPayload.required);
  assert(plan.neverModify.includes("www"), "one-click plan must never modify www");
  assert(plan.upsert.length === 3, "one-click upserts only required records");
  console.log("OK  one-click provider plan stubs");

  try {
    buildDnsRecordsForDomain("example.com", { mailIpv4: "0.0.0.0" });
    throw new Error("Expected placeholder IP rejection");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("IPv4")) throw error;
    console.log("OK  rejected placeholder 0.0.0.0");
  }

  process.env.MAIL_HOSTNAME = "mail.custom-mail.example";
  assert(getMailHostname() === "mail.custom-mail.example", "MAIL_HOSTNAME override failed");
  console.log("OK  MAIL_HOSTNAME env override");

  console.log("DNS generation tests passed.");
}

main();
