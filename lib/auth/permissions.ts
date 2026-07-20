/**
 * GLOBAL ORBIT MAIL — Authentication Architecture
 * Phase 1: Structure only. No live auth flows.
 *
 * Prepared for:
 * - User Login (webmail.theglobalorbit.com)
 * - Super Admin Login (orbit.theglobalorbit.com)
 * - Role-based access control
 * - Permission matrix
 * - JWT + session management
 * - 2FA readiness
 */

import type { Permission, Role } from "@/types";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ["admin:full"],
  ORG_ADMIN: [
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
  ],
  DOMAIN_ADMIN: [
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
  ],
  MAILBOX_USER: ["mailbox:read", "mailbox:write", "settings:read"],
  VIEWER: ["org:read", "domain:read", "user:read", "mailbox:read", "analytics:read"],
} as const;

export function hasPermission(role: Role, permission: Permission): boolean {
  const grants = ROLE_PERMISSIONS[role];
  if (grants.includes("admin:full")) return true;
  return grants.includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export interface AuthSessionShape {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
    organizationId?: string | null;
    twoFactorEnabled: boolean;
  };
  expires: string;
}

/** Placeholder for future NextAuth / Auth.js configuration wiring. */
export const authArchitecture = {
  providers: ["credentials", "passkey"] as const,
  sessionStrategy: "jwt" as const,
  twoFactor: {
    enabled: false,
    methods: ["totp", "email"] as const,
  },
  surfaces: {
    user: "portal",
    admin: "admin",
  },
} as const;
