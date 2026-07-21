/**
 * Domain hostname helpers (safe for client + server).
 * Always store apex domains only — never www.
 */

export function normalizeApexDomain(input: string): string {
  let value = String(input ?? "").trim().toLowerCase();

  // Strip credentials / protocol / path / query / hash / port leftovers
  value = value.replace(/^https?:\/\//i, "");
  value = value.replace(/^\/\//, "");
  value = value.split("/")[0] ?? value;
  value = value.split("?")[0] ?? value;
  value = value.split("#")[0] ?? value;
  value = value.replace(/:\d+$/, "");
  value = value.replace(/\.$/, "");
  value = value.replace(/\.+$/, "");

  // Strip www. repeatedly
  while (value.startsWith("www.")) {
    value = value.slice(4);
  }

  // Common trailing junk
  value = value.replace(/\/+$/, "").trim();

  // Unicode → punycode (IDNA) when possible
  if (value && /[^\x00-\x7f]/.test(value)) {
    try {
      value = new URL(`http://${value}`).hostname.toLowerCase();
    } catch {
      // leave as-is; validation will reject if invalid
    }
  }

  return value;
}

export function isValidApexDomain(name: string): boolean {
  const apex = normalizeApexDomain(name);
  if (!apex || apex.length < 3 || apex.length > 253) return false;
  if (apex.startsWith("www.") || apex.includes("://") || apex.includes("/")) return false;
  if (apex.includes("..") || apex.startsWith("-") || apex.endsWith("-")) return false;
  // hostname labels
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(apex);
}

export function domainLookupVariants(input: string): string[] {
  const apex = normalizeApexDomain(input);
  if (!apex) return [];
  const variants = new Set<string>([apex, `www.${apex}`]);
  return [...variants];
}
