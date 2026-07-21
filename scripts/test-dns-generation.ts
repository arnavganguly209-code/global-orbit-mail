/**
 * Quick DNS generator sanity checks (no DB required).
 * Usage: npx tsx scripts/test-dns-generation.ts
 */

import {
  buildDnsRecordsForDomain,
  getMailHostname,
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
  // Simulate production env for deterministic tests
  process.env.MAIL_HOSTNAME = "mail.globalorbitmail.cloud";
  process.env.MAIL_SERVER_IPV4 = "200.97.170.235";

  const mailIpv4 = process.env.MAIL_SERVER_IPV4;
  const mailHost = getMailHostname();

  assert(mailHost === "mail.globalorbitmail.cloud", `unexpected mail host ${mailHost}`);
  assert(!mailHost.endsWith(".com"), "mail host must not default to .com");

  for (const input of CASES) {
    const apex = normalizeApexDomain(input);
    assert(!apex.startsWith("www."), `apex still has www for ${input} → ${apex}`);

    const records = buildDnsRecordsForDomain(input, {
      mailIpv4,
      dkimDnsValue: "v=DKIM1; k=rsa; p=TESTPUBLICKEY",
    });
    const payload = toDnsInstructionJson(apex, records);

    const mx = records.find((r) => r.purpose === "mx");
    const spf = records.find((r) => r.purpose === "spf");
    const mailA = records.find((r) => r.purpose === "mail_a");

    assert(mx?.host === "@", "MX host must be @");
    assert(mx?.value === `${mailHost}.`, `MX must point to ${mailHost}., got ${mx?.value}`);
    assert(spf?.value === `v=spf1 mx a:${mailHost} -all`, `SPF mismatch: ${spf?.value}`);
    assert(mailA?.value === mailIpv4, `mail A must be ${mailIpv4}, got ${mailA?.value}`);
    assert(!records.some((r) => r.value.includes("mail.globalorbitmail.com")), ".com mail host leaked");

    assert(payload.required.length >= 3, `expected >=3 required for ${input}`);
    assert(
      payload.required.every((r) => ["mx", "spf", "mail_a", "verification"].includes(r.purpose)),
      `non-required in required tier for ${input}`,
    );
    assert(
      payload.advanced.every((r) => !["mx", "spf", "mail_a"].includes(r.purpose)),
      `core record leaked into advanced for ${input}`,
    );
    assert(!payload.flat.some((r) => r.fqdn.includes("www")), `www leaked for ${input}`);

    console.log(
      `OK  ${input.padEnd(36)} → MX=${mx?.value} SPF=${spf?.value} A=${mailA?.value}`,
    );
  }

  const merge = recommendSpfMerge(
    "v=spf1 include:_spf.google.com ~all",
    mailHost,
  );
  assert(merge.recommended.includes(`a:${mailHost}`), "SPF merge missing mail host");
  assert(merge.recommended.includes("include:_spf.google.com"), "SPF merge dropped existing include");
  console.log("OK  SPF merge recommendation");

  try {
    buildDnsRecordsForDomain("example.com", { mailIpv4: "0.0.0.0" });
    throw new Error("Expected placeholder IP rejection");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("IPv4")) throw error;
    console.log("OK  rejected placeholder 0.0.0.0");
  }

  // Env override must win
  process.env.MAIL_HOSTNAME = "mail.custom-mail.example";
  assert(getMailHostname() === "mail.custom-mail.example", "MAIL_HOSTNAME override failed");
  console.log("OK  MAIL_HOSTNAME env override");

  console.log("DNS generation tests passed.");
}

main();
