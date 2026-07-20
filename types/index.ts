/**
 * GLOBAL ORBIT MAIL — Shared Domain Types
 */

export type ThemeMode = "light" | "dark" | "system";

export type PortalSurface = "marketing" | "auth" | "portal" | "admin";

export type Permission =
  | "org:read"
  | "org:write"
  | "domain:read"
  | "domain:write"
  | "user:read"
  | "user:write"
  | "mailbox:read"
  | "mailbox:write"
  | "dns:read"
  | "dns:write"
  | "ssl:read"
  | "ssl:write"
  | "logs:read"
  | "settings:read"
  | "settings:write"
  | "analytics:read"
  | "admin:full";

export type Role =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "DOMAIN_ADMIN"
  | "MAILBOX_USER"
  | "VIEWER";

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  disabled?: boolean;
  children?: NavItem[];
}
