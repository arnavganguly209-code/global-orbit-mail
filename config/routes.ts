/**
 * GLOBAL ORBIT MAIL — Site Routes & External Portals
 */

import { brand } from "@/config/brand";

export const external = {
  webmail: `https://${brand.portals.user}`,
  admin: `https://${brand.portals.admin}`,
  company: brand.companyUrl,
} as const;

export const routes = {
  home: "/",
  login: "/login",
  adminLogin: "/admin/login",
  sections: {
    features: "/#features",
    solutions: "/#solutions",
    enterprise: "/#enterprise",
    pricing: "/#pricing",
    resources: "/#resources",
    documentation: "/#documentation",
    contact: "/#contact",
    faq: "/#faq",
    howItWorks: "/#how-it-works",
    why: "/#why",
  },
  legal: {
    privacy: "/privacy",
    terms: "/terms",
    refund: "/refund",
    cookies: "/cookies",
  },
  portal: {
    root: "/portal",
  },
  admin: {
    root: "/admin",
    domains: "/admin/domains",
    mailboxes: "/admin/mailboxes",
    users: "/admin/users",
    dns: "/admin/dns",
    logs: "/admin/logs",
    monitoring: "/admin/monitoring",
    settings: "/admin/settings",
  },
  api: {
    health: "/api/health",
    admin: {
      dashboard: "/api/admin/dashboard",
      domains: "/api/admin/domains",
      mailboxes: "/api/admin/mailboxes",
      dns: "/api/admin/dns",
      users: "/api/admin/users",
      audit: "/api/admin/audit",
      settings: "/api/admin/settings",
      monitoring: "/api/admin/monitoring",
    },
  },
} as const;

export type AppRoutes = typeof routes;
