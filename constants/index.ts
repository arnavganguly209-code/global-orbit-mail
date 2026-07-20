/**
 * GLOBAL ORBIT MAIL — Application Constants
 */

export const APP_NAME = "GLOBAL ORBIT MAIL";
export const COMPANY_NAME = "GLOBAL ORBIT PVT. LTD.";
export const TAGLINE = "Enterprise Mail Platform";

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export const QUERY_KEYS = {
  session: ["session"] as const,
  health: ["health"] as const,
  organizations: ["organizations"] as const,
  domains: ["domains"] as const,
  users: ["users"] as const,
} as const;

export const STORAGE_KEYS = {
  theme: "go-mail-theme",
  sidebarCollapsed: "go-mail-sidebar-collapsed",
} as const;
