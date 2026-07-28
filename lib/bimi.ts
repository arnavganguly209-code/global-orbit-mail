/**
 * BIMI (Brand Indicators for Message Identification) helpers.
 * Gmail's round sender avatar requires BIMI DNS + SVG Tiny PS + a paid VMC.
 */

import { normalizeApexDomain } from "@/lib/dns/domain-name";

const DEFAULT_PUBLIC_ORIGIN = "https://globalorbitmail.cloud";

export function getPublicAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    DEFAULT_PUBLIC_ORIGIN;
  return raw.replace(/\/$/, "");
}

export function buildBimiLogoUrl(domainName: string): string {
  const apex = normalizeApexDomain(domainName);
  return `${getPublicAppOrigin()}/api/public/bimi/${encodeURIComponent(apex)}`;
}

/** BIMI TXT value. Omit `a=` until a Verified Mark Certificate URL exists. */
export function buildBimiDnsValue(options: {
  logoUrl: string;
  authorityUrl?: string | null;
}): string {
  const logo = options.logoUrl.trim();
  if (!logo) throw new Error("BIMI requires a public logo URL");
  const parts = [`v=BIMI1`, `l=${logo}`];
  const authority = (options.authorityUrl ?? "").trim();
  if (authority) parts.push(`a=${authority}`);
  return parts.join("; ");
}

export function isSvgDataUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /^data:image\/svg\+xml/i.test(value.trim());
}

/**
 * Decode a data:image/svg+xml URL to raw SVG text.
 * Supports base64 and URL-encoded payloads.
 */
export function decodeSvgDataUrl(dataUrl: string): string | null {
  const raw = dataUrl.trim();
  const match = /^data:image\/svg\+xml([^,]*),(.*)$/i.exec(raw);
  if (!match) return null;
  const meta = match[1] ?? "";
  const payload = match[2] ?? "";
  try {
    if (/;base64/i.test(meta)) {
      return Buffer.from(payload, "base64").toString("utf8");
    }
    return decodeURIComponent(payload.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

export function looksLikeSvg(svg: string): boolean {
  const trimmed = svg.trim();
  return /<svg[\s>]/i.test(trimmed) && /<\/svg>/i.test(trimmed);
}
