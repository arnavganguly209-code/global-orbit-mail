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
  },
  api: {
    health: "/api/health",
  },
} as const;

export type AppRoutes = typeof routes;
