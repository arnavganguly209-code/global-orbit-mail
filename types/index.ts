/**
 * GLOBAL ORBIT MAIL — Enterprise Types (Phase 2A)
 */

export type ThemeMode = "light" | "dark" | "system";

export type PortalSurface = "marketing" | "auth" | "portal" | "admin";

export type SystemRole =
  | "SUPER_ADMIN"
  | "RESELLER"
  | "CUSTOMER"
  | "SUPPORT_STAFF"
  | "MAILBOX_USER";

/** @deprecated Prefer SystemRole — kept for Phase 1 compatibility */
export type Role = SystemRole | "ORG_ADMIN" | "DOMAIN_ADMIN" | "VIEWER";

export type Permission =
  | "admin:full"
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
  | "logs:export"
  | "settings:read"
  | "settings:write"
  | "analytics:read"
  | "monitoring:read"
  | "billing:read"
  | "billing:write"
  | "api:read"
  | "api:write"
  | "security:read"
  | "security:write"
  | "support:read"
  | "support:write";

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
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

export type DomainLifecycleStatus =
  | "PENDING"
  | "VERIFYING"
  | "ACTIVE"
  | "SUSPENDED"
  | "FAILED";

export type VerificationTone = "success" | "warning" | "danger" | "neutral";

export interface AdminDomain {
  id: string;
  name: string;
  status: DomainLifecycleStatus;
  sslStatus: "NONE" | "PENDING" | "ACTIVE" | "EXPIRED" | "FAILED";
  dnsStatus: "UNKNOWN" | "PENDING" | "PARTIAL" | "VERIFIED" | "FAILED";
  mailStatus: "DISABLED" | "PROVISIONING" | "ACTIVE" | "SUSPENDED" | "ERROR";
  organizationId: string;
  mailboxCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMailbox {
  id: string;
  email: string;
  localPart: string;
  domainId: string;
  domainName: string;
  displayName: string | null;
  quotaMb: number;
  usedMb: number;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED" | "PENDING";
  aliasCount: number;
  forwarderCount: number;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: SystemRole;
  status: "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED";
  organizationId: string | null;
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface DnsRecordView {
  id: string;
  domainId: string;
  type: "MX" | "SPF" | "DKIM" | "DMARC" | "TXT" | "A" | "CNAME";
  name: string;
  value: string;
  priority?: number | null;
  status: "EXPECTED" | "DETECTED" | "MISSING" | "MISMATCH" | "VERIFIED" | "PENDING";
  tone: VerificationTone;
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface DashboardMetrics {
  domains: number;
  activeDomains: number;
  mailboxes: number;
  users: number;
  aliases: number;
  forwarders: number;
  auditLogs: number;
  notifications: number;
  unreadNotifications: number;
  storageUsedGb: number;
  storageQuotaGb: number;
  spamBlocked24h: number;
  mailQueueDepth: number;
}

export interface AdminProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: SystemRole;
  roleName: string;
  company: string | null;
  organizationId: string | null;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  status: string;
}

export interface SystemHealthComponent {
  id: string;
  name: string;
  status: "operational" | "degraded" | "down" | "awaiting_integration";
  detail: string;
}

export interface MonitoringSnapshot {
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  mailQueue: number | null;
  components: SystemHealthComponent[];
  series: { label: string; mail: number; spam: number }[];
}
