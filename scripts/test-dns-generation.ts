/**
 * Quick DNS generator sanity checks (no DB required).
 * Usage: npx tsx scripts/test-dns-generation.ts
 */

import {
  buildDnsRecordsForDomain,
  normalizeApexDomain,
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
  const mailIpv4 = "203.0.113.10"; // documentation/test IP — not a placeholder zero

  for (const input of CASES) {
    const apex = normalizeApexDomain(input);
    assert(!apex.startsWith("www."), `apex still has www for ${input} → ${apex}`);
    assert(!apex.includes(".www."), `apex nested www for ${input} → ${apex}`);

    const records = buildDnsRecordsForDomain(input, {
      mailIpv4,
      dkimDnsValue: "v=DKIM1; k=rsa; p=TESTPUBLICKEY",
    });
    const payload = toDnsInstructionJson(apex, records);

    assert(payload.domain === apex, `payload domain mismatch for ${input}`);
    assert(!payload.flat.some((r) => r.host.includes("www") || r.fqdn.includes("www")), `www leaked for ${input}`);
    assert(!payload.flat.some((r) => r.value === "0.0.0.0"), `placeholder IP for ${input}`);

    const mailA = payload.flat.find((r) => r.purpose === "mail_a");
    const mx = payload.flat.find((r) => r.purpose === "mx");
    assert(mailA?.host === "mail", `mail host not relative for ${input}: ${mailA?.host}`);
    assert(mailA?.fqdn === `mail.${apex}`, `mail fqdn wrong for ${input}: ${mailA?.fqdn}`);
    assert(mx?.host === "@", `MX host must be @ for ${input}: ${mx?.host}`);
    assert(mx?.fqdn === apex, `MX fqdn must be apex for ${input}: ${mx?.fqdn}`);
    assert(mailA?.value === mailIpv4, `mail A IP wrong for ${input}`);

    console.log(`OK  ${input.padEnd(36)} → apex=${apex}  mail=${mailA?.fqdn}  mxHost=${mx?.host}`);
  }

  try {
    buildDnsRecordsForDomain("example.com", { mailIpv4: "0.0.0.0" });
    throw new Error("Expected placeholder IP rejection");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("IPv4")) {
      throw error;
    }
    console.log("OK  rejected placeholder 0.0.0.0");
  }

  console.log("DNS generation tests passed.");
}

main();
