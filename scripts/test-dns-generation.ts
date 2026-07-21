/**
 * Quick DNS generator sanity checks (no DB required).
 * Usage: npx tsx scripts/test-dns-generation.ts
 */

import {
  buildDnsRecordsForDomain,
  normalizeApexDomain,
  recommendSpfMerge,
  toDnsInstructionJson,
} from "../lib/dns/records";

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
  const mailIpv4 = "203.0.113.10";

  for (const input of CASES) {
    const apex = normalizeApexDomain(input);
    assert(!apex.startsWith("www."), `apex still has www for ${input} → ${apex}`);

    const records = buildDnsRecordsForDomain(input, {
      mailIpv4,
      dkimDnsValue: "v=DKIM1; k=rsa; p=TESTPUBLICKEY",
    });
    const payload = toDnsInstructionJson(apex, records);

    assert(payload.required.length >= 3, `expected >=3 required for ${input}`);
    assert(
      payload.required.every((r) => ["mx", "spf", "mail_a", "verification"].includes(r.purpose)),
      `non-required in required tier for ${input}`,
    );
    assert(
      payload.advanced.every((r) => !["mx", "spf", "mail_a"].includes(r.purpose)),
      `core record leaked into advanced for ${input}`,
    );
    assert(payload.required.some((r) => r.purpose === "mx" && r.host === "@"), "MX @ missing");
    assert(
      payload.required.some((r) => r.purpose === "mail_a" && r.fqdn === `mail.${apex}`),
      "mail A missing",
    );
    assert(!payload.flat.some((r) => r.fqdn.includes("www")), `www leaked for ${input}`);

    console.log(
      `OK  ${input.padEnd(36)} → required=${payload.required.length} advanced=${payload.advanced.length}`,
    );
  }

  const merge = recommendSpfMerge(
    "v=spf1 include:_spf.google.com ~all",
    "mail.globalorbitmail.com",
  );
  assert(merge.recommended.includes("a:mail.globalorbitmail.com"), "SPF merge missing mail host");
  assert(merge.recommended.includes("include:_spf.google.com"), "SPF merge dropped existing include");
  console.log("OK  SPF merge recommendation");

  try {
    buildDnsRecordsForDomain("example.com", { mailIpv4: "0.0.0.0" });
    throw new Error("Expected placeholder IP rejection");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("IPv4")) throw error;
    console.log("OK  rejected placeholder 0.0.0.0");
  }

  console.log("DNS generation tests passed.");
}

main();
