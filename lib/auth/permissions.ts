/**
 * GLOBAL ORBIT MAIL — RBAC Architecture (Phase 3A)
 * Production session cookie + NextAuth-compatible role map.
 */

import type { Permission, SystemRole } from "@/types";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export { SESSION_COOKIE };

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
    "dns:read",
    "logs:read",
    "logs:export",
    "monitoring:read",
    "support:read",
    "support:write",
    "security:read",
  ],
  MAILBOX_USER: ["mailbox:read", "mailbox:write", "settings:read"],
} as const;

export function hasPermission(role: SystemRole, permission: Permission): boolean {
  const grants = ROLE_PERMISSIONS[role];
  if (grants.includes("admin:full")) return true;
  return grants.includes(permission);
}

export function hasAnyPermission(role: SystemRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function requirePermission(role: SystemRole, permission: Permission): void {
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
  roles: [
    "SUPER_ADMIN",
    "RESELLER",
    "CUSTOMER",
    "SUPPORT_STAFF",
    "MAILBOX_USER",
  ] as const satisfies readonly SystemRole[],
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
