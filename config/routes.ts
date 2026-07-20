/**
 * GLOBAL ORBIT MAIL — Site Routes
 * Central route map for marketing, auth, portal, and admin surfaces.
 */

export const routes = {
  home: "/",
  login: "/login",
  adminLogin: "/admin/login",
  portal: {
    root: "/portal",
    inbox: "/portal/inbox",
    settings: "/portal/settings",
  },
  admin: {
    root: "/admin",
    organizations: "/admin/organizations",
    domains: "/admin/domains",
    users: "/admin/users",
    settings: "/admin/settings",
    analytics: "/admin/analytics",
  },
  api: {
    health: "/api/health",
    auth: "/api/auth",
  },
} as const;

export type AppRoutes = typeof routes;
