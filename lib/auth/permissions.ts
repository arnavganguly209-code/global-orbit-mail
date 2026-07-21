/**
 * GLOBAL ORBIT MAIL — RBAC Architecture
 * SUPER_ADMIN bypasses all permission checks. Other roles use explicit grants.
 */

import type { Permission, SystemRole } from "@/types";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export { SESSION_COOKIE };

export const SYSTEM_ROLES = [
  "SUPER_ADMIN",
  "RESELLER",
  "CUSTOMER",
  "SUPPORT_STAFF",
  "MAILBOX_USER",
] as const satisfies readonly SystemRole[];

export const ADMIN_ROLES = ["SUPER_ADMIN", "SUPPORT_STAFF", "RESELLER"] as const satisfies readonly SystemRole[];

export const ROLE_PERMISSIONS: Record<SystemRole, readonly Permission[]> = {
  SUPER_ADMIN: ["admin:full"],
  RESELLER: [
    "org:read",
    "org:write",
    "domain:read",
    "domain:write",
    "user:read",
    "user:write",
    "mailbox:read",
    "mailbox:write",
    "dns:read",
    "dns:write",
    "ssl:read",
    "ssl:write",
    "logs:read",
    "settings:read",
    "settings:write",
    "analytics:read",
    "billing:read",
    "billing:write",
    "api:read",
    "support:read",
  ],
  CUSTOMER: [
    "org:read",
    "domain:read",
    "domain:write",
    "user:read",
    "user:write",
    "mailbox:read",
    "mailbox:write",
    "dns:read",
    "dns:write",
    "ssl:read",
    "logs:read",
    "settings:read",
    "settings:write",
    "billing:read",
  ],
  SUPPORT_STAFF: [
    "org:read",
    "domain:read",
    "user:read",
    "mailbox:read",
    "mailbox:write",
    "dns:read",
    "dns:write",
    "logs:read",
    "logs:export",
    "monitoring:read",
    "support:read",
    "support:write",
    "security:read",
  ],
  MAILBOX_USER: ["mailbox:read", "mailbox:write", "settings:read"],
} as const;

export function normalizeSystemRole(value: unknown): SystemRole | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toUpperCase();
  return (SYSTEM_ROLES as readonly string[]).includes(key) ? (key as SystemRole) : null;
}

export function isSuperAdmin(role: SystemRole | string | null | undefined): boolean {
  return normalizeSystemRole(role) === "SUPER_ADMIN";
}

export function isAdminRole(role: SystemRole | string | null | undefined): boolean {
  const normalized = normalizeSystemRole(role);
  return normalized !== null && (ADMIN_ROLES as readonly string[]).includes(normalized);
}

export function hasPermission(role: SystemRole | string | null | undefined, permission: Permission): boolean {
  // Super Admin always bypasses every permission check.
  if (isSuperAdmin(role)) return true;

  const normalized = normalizeSystemRole(role);
  if (!normalized) return false;

  const grants = ROLE_PERMISSIONS[normalized];
  if (!grants) return false;
  if (grants.includes("admin:full")) return true;
  return grants.includes(permission);
}

export function hasAnyPermission(
  role: SystemRole | string | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function requirePermission(
  role: SystemRole | string | null | undefined,
  permission: Permission,
): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}

export interface AuthSessionShape {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: SystemRole;
    organizationId?: string | null;
    twoFactorEnabled: boolean;
  };
  expires: string;
}

export const authArchitecture = {
  providers: ["credentials", "passkey"] as const,
  sessionStrategy: "jwt" as const,
  roles: SYSTEM_ROLES,
  twoFactor: {
    enabled: false,
    methods: ["totp", "email"] as const,
  },
  surfaces: {
    user: "portal",
    admin: "admin",
  },
  enforceAdminAuth: process.env.ADMIN_AUTH_ENFORCE !== "false",
} as const;
