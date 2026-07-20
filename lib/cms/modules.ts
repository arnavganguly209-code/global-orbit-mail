/**
 * GLOBAL ORBIT MAIL — Custom Enterprise CMS Architecture
 * Never WordPress. Never third-party CMS code.
 *
 * Future modules (structure only):
 * Domains, Mail Accounts, Users, Roles, Organizations,
 * DNS, SPF, DKIM, DMARC, PTR, SSL, Logs, Settings, Analytics
 */

export type CmsModuleId =
  | "organizations"
  | "domains"
  | "mail-accounts"
  | "users"
  | "roles"
  | "dns"
  | "spf"
  | "dkim"
  | "dmarc"
  | "ptr"
  | "ssl"
  | "logs"
  | "settings"
  | "analytics";

export interface CmsModuleDefinition {
  id: CmsModuleId;
  label: string;
  description: string;
  href: string;
  phase: number;
  enabled: boolean;
}

export const cmsModules: readonly CmsModuleDefinition[] = [
  {
    id: "organizations",
    label: "Organizations",
    description: "Multi-tenant organization management",
    href: "/admin/organizations",
    phase: 2,
    enabled: false,
  },
  {
    id: "domains",
    label: "Domains",
    description: "Custom domain provisioning and verification",
    href: "/admin/domains",
    phase: 2,
    enabled: false,
  },
  {
    id: "mail-accounts",
    label: "Mail Accounts",
    description: "Mailbox lifecycle and quotas",
    href: "/admin/mail-accounts",
    phase: 3,
    enabled: false,
  },
  {
    id: "users",
    label: "Users",
    description: "Identity and access management",
    href: "/admin/users",
    phase: 2,
    enabled: false,
  },
  {
    id: "roles",
    label: "Roles",
    description: "Role and permission governance",
    href: "/admin/roles",
    phase: 2,
    enabled: false,
  },
  {
    id: "dns",
    label: "DNS",
    description: "DNS record orchestration",
    href: "/admin/dns",
    phase: 3,
    enabled: false,
  },
  {
    id: "spf",
    label: "SPF",
    description: "Sender Policy Framework configuration",
    href: "/admin/dns/spf",
    phase: 3,
    enabled: false,
  },
  {
    id: "dkim",
    label: "DKIM",
    description: "DomainKeys Identified Mail signing",
    href: "/admin/dns/dkim",
    phase: 3,
    enabled: false,
  },
  {
    id: "dmarc",
    label: "DMARC",
    description: "Domain-based message authentication",
    href: "/admin/dns/dmarc",
    phase: 3,
    enabled: false,
  },
  {
    id: "ptr",
    label: "PTR",
    description: "Reverse DNS pointer records",
    href: "/admin/dns/ptr",
    phase: 3,
    enabled: false,
  },
  {
    id: "ssl",
    label: "SSL",
    description: "Certificate lifecycle management",
    href: "/admin/ssl",
    phase: 3,
    enabled: false,
  },
  {
    id: "logs",
    label: "Logs",
    description: "Audit and operational telemetry",
    href: "/admin/logs",
    phase: 4,
    enabled: false,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Platform and organization settings",
    href: "/admin/settings",
    phase: 2,
    enabled: false,
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Usage and delivery intelligence",
    href: "/admin/analytics",
    phase: 4,
    enabled: false,
  },
] as const;

export function getCmsModulesByPhase(phase: number) {
  return cmsModules.filter((module) => module.phase === phase);
}
