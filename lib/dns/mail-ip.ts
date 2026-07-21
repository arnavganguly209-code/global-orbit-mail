/**
 * Resolve production mail server IPv4 (server-only).
 * Never returns placeholder addresses like 0.0.0.0.
 */

import { promises as dns } from "node:dns";
import { getConfiguredMailHostname } from "@/lib/dns/mail-host";

const PLACEHOLDER_IPS = new Set([
  "",
  "0.0.0.0",
  "127.0.0.1",
  "::",
  "::1",
  "localhost",
]);

export function isUsableIpv4(ip: string | null | undefined): boolean {
  const value = (ip ?? "").trim();
  if (!value || PLACEHOLDER_IPS.has(value.toLowerCase())) return false;
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

export function isUsableIpv6(ip: string | null | undefined): boolean {
  const value = (ip ?? "").trim();
  if (!value || PLACEHOLDER_IPS.has(value.toLowerCase())) return false;
  return value.includes(":");
}

/**
 * Prefer MAIL_SERVER_IPV4 when it is a real public/production address.
 * Otherwise resolve A records for MAIL_HOSTNAME.
 */
export async function resolveMailServerIpv4(): Promise<string> {
  const configured = process.env.MAIL_SERVER_IPV4?.trim() ?? "";
  if (isUsableIpv4(configured)) return configured;

  const host = getConfiguredMailHostname();

  try {
    const addrs = await dns.resolve4(host);
    const ip = addrs.find((addr) => isUsableIpv4(addr));
    if (ip) return ip;
  } catch {
    // fall through to explicit error
  }

  throw new Error(
    `Mail server IPv4 is not configured. Set MAIL_SERVER_IPV4 to the production mail IP (never 0.0.0.0), or ensure ${host} resolves publicly.`,
  );
}

export async function resolveMailServerIpv6(): Promise<string | null> {
  const configured = process.env.MAIL_SERVER_IPV6?.trim() ?? "";
  if (isUsableIpv6(configured)) return configured;

  const host = getConfiguredMailHostname();

  try {
    const addrs = await dns.resolve6(host);
    const ip = addrs.find((addr) => isUsableIpv6(addr));
    return ip ?? null;
  } catch {
    return null;
  }
}
