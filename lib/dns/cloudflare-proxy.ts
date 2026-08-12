/**
 * Rough Cloudflare anycast / proxy detection for public A records.
 * Proxied orange-cloud MX/mail A breaks SMTP; HTTP discovery hosts may be proxied.
 */
export function isLikelyCloudflareProxyIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return false;
  const [a, b] = parts as [number, number, number, number];
  // Common Cloudflare published ranges (subset — enough to warn / detect strongly)
  if (a === 104 && b >= 16 && b <= 31) return true; // 104.16.0.0/12
  if (a === 172 && b >= 64 && b <= 71) return true; // 172.64.0.0/13
  if (a === 173 && b === 245) return true; // 173.245.48.0/20 approx
  if (a === 103 && b >= 21 && b <= 22) return true;
  if (a === 141 && b === 101) return true;
  if (a === 188 && b === 114) return true;
  if (a === 190 && b === 93) return true;
  if (a === 197 && b === 234) return true;
  if (a === 198 && b === 41) return true;
  if (a === 162 && b === 158) return true;
  if (a === 108 && b === 162) return true;
  return false;
}
