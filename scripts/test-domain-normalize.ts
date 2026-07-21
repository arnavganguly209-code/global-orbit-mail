/**
 * Domain normalization + idempotent create rules (no DB required).
 * Usage: npx tsx scripts/test-domain-normalize.ts
 */

import {
  domainLookupVariants,
  isValidApexDomain,
  normalizeApexDomain,
} from "../lib/dns/domain-name";
import { domainCreateSchema } from "../lib/validations/admin";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const CASES: Array<[string, string]> = [
  ["zenspanp.com", "zenspanp.com"],
  ["www.zenspanp.com", "zenspanp.com"],
  ["https://zenspanp.com", "zenspanp.com"],
  ["https://www.zenspanp.com", "zenspanp.com"],
  ["https://www.zenspanp.com/", "zenspanp.com"],
  ["HTTPS://ZENSPANP.COM", "zenspanp.com"],
  [" ZENSPANP.COM ", "zenspanp.com"],
  ["http://www.zenspanp.com/path?x=1", "zenspanp.com"],
  ["www.www.zenspanp.com", "zenspanp.com"],
];

function main() {
  for (const [input, expected] of CASES) {
    const apex = normalizeApexDomain(input);
    assert(apex === expected, `normalize(${input}) → ${apex}, expected ${expected}`);
    assert(isValidApexDomain(apex), `invalid after normalize: ${input}`);
    const parsed = domainCreateSchema.parse({ name: input });
    assert(parsed.name === expected, `schema(${input}) → ${parsed.name}`);
    console.log(`OK  ${JSON.stringify(input).padEnd(40)} → ${apex}`);
  }

  const variants = domainLookupVariants("www.zenspanp.com");
  assert(variants.includes("zenspanp.com"), "missing apex variant");
  assert(variants.includes("www.zenspanp.com"), "missing www variant");
  console.log("OK  lookup variants");

  try {
    domainCreateSchema.parse({ name: "not a domain" });
    throw new Error("expected invalid");
  } catch {
    console.log("OK  invalid domain rejected");
  }

  console.log("Domain normalization tests passed.");
}

main();
