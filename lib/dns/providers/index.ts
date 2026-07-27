/**
 * Future one-click DNS provider integrations (Hostinger, Cloudflare, GoDaddy, Namecheap).
 * Architecture stubs only — no live API calls yet.
 */

export type DnsProviderId = "hostinger" | "cloudflare" | "godaddy" | "namecheap" | "manual";

export type DnsProviderCapability = {
  id: DnsProviderId;
  label: string;
  status: "available_soon" | "manual" | "connected";
  supportsOneClick: boolean;
  description: string;
};

export type OneClickDnsPlan = {
  provider: DnsProviderId;
  domain: string;
  /** Records that would be upserted (mail-only; never www/@ website) */
  upsert: Array<{
    type: string;
    host: string;
    value: string;
    priority?: number | null;
    ttl?: number;
  }>;
  /** Explicit non-touch hosts (website safety) */
  neverModify: string[];
};

export const DNS_PROVIDERS: DnsProviderCapability[] = [
  {
    id: "manual",
    label: "Manual copy",
    status: "manual",
    supportsOneClick: false,
    description: "Copy Required DNS into your registrar panel (works everywhere).",
  },
  {
    id: "hostinger",
    label: "Hostinger",
    status: "available_soon",
    supportsOneClick: true,
    description: "One-click publish via Hostinger DNS API (coming soon).",
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    status: "available_soon",
    supportsOneClick: true,
    description: "One-click publish via Cloudflare API — proxy stays orange on www (coming soon).",
  },
  {
    id: "godaddy",
    label: "GoDaddy",
    status: "available_soon",
    supportsOneClick: true,
    description: "One-click publish via GoDaddy Domains API (coming soon).",
  },
  {
    id: "namecheap",
    label: "Namecheap",
    status: "available_soon",
    supportsOneClick: true,
    description: "One-click publish via Namecheap API (coming soon).",
  },
];

/** Build a provider-neutral plan from required mail records (never includes www/@ website). */
export function buildOneClickDnsPlan(
  provider: DnsProviderId,
  domain: string,
  required: Array<{
    publishType?: string;
    type?: string;
    host: string;
    value: string;
    priority?: number | null;
    ttl?: number;
  }>,
): OneClickDnsPlan {
  return {
    provider,
    domain,
    upsert: required.map((r) => ({
      type: (r.publishType ?? r.type ?? "TXT").toUpperCase(),
      host: r.host,
      value: r.value,
      priority: r.priority ?? null,
      ttl: r.ttl ?? 3600,
    })),
    neverModify: ["@", "www", `www.${domain}`],
  };
}
