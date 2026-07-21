/**
 * GLOBAL ORBIT MAIL — Site Routes & External Portals
 */

import { brand } from "@/config/brand";

export const external = {
  webmail: `https://${brand.portals.user}`,
  admin: `https://${brand.siteHost}/orbit`,
  company: brand.companyUrl,
} as const;

export const routes = {
  home: "/",
  login: "/login",
  signin: "/signin",
  signup: "/signup",
  orbitLogin: "/orbit/login",
  dashboard: "/dashboard",
  webmail: "/webmail",
  pages: {
    features: "/features",
    pricing: "/pricing",
    businessEmail: "/business-email",
    enterprise: "/enterprise",
    about: "/about",
    contact: "/contact",
    documentation: "/documentation",
    status: "/contact?intent=status",
  },
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
    security: "/#security",
    migration: "/#migration",
  },
  legal: {
    privacy: "/privacy",
    terms: "/terms",
    refund: "/refund",
    cookies: "/cookies",
    aup: "/legal/aup",
    security: "/legal/security",
    gdpr: "/legal/gdpr",
  },
  portal: {
    root: "/portal",
  },
  orbit: {
    root: "/orbit",
    domains: "/orbit/domains",
    mailboxes: "/orbit/mailboxes",
    users: "/orbit/users",
    dns: "/orbit/dns",
    logs: "/orbit/logs",
    monitoring: "/orbit/monitoring",
    settings: "/orbit/settings",
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
