/**
 * GLOBAL ORBIT MAIL — RBAC Architecture (Phase 2A)
 * NextAuth-compatible session shape. Live auth not connected yet.
 */

import type { Permission, SystemRole } from "@/types";

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

export const SESSION_COOKIE = "go_mail_session";

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
  /** When true, middleware enforces session on /admin/* */
  enforceAdminAuth: process.env.ADMIN_AUTH_ENFORCE === "true",
} as const;

/** Dev/architecture actor used until NextAuth is wired. */
export const architectureAdminSession: AuthSessionShape = {
  user: {
    id: "arch_super_admin",
    email: "admin@theglobalorbit.com",
    name: "Super Admin",
    role: "SUPER_ADMIN",
    organizationId: "org_global_orbit",
    twoFactorEnabled: false,
  },
  expires: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
};
