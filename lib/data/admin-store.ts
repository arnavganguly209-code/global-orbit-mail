/**
 * Phase 2A operational store.
 * Modular in-memory repository backing until PostgreSQL is provisioned.
 * Swap implementations in repositories/* to Prisma without changing UI/services.
 */

import { randomUUID } from "crypto";
import type {
  AdminDomain,
  AdminMailbox,
  AdminUser,
  AuditLogEntry,
  DnsRecordView,
} from "@/types";

const ORG_ID = "org_global_orbit";

function now() {
  return new Date().toISOString();
}

function createInitialDomains(): AdminDomain[] {
  return [
    {
      id: "dom_theglobalorbit",
      name: "theglobalorbit.com",
      status: "ACTIVE",
      sslStatus: "ACTIVE",
      dnsStatus: "VERIFIED",
      mailStatus: "ACTIVE",
      organizationId: ORG_ID,
      mailboxCount: 3,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "dom_mail_preview",
      name: "mail.theglobalorbit.com",
      status: "VERIFYING",
      sslStatus: "PENDING",
      dnsStatus: "PARTIAL",
      mailStatus: "PROVISIONING",
      organizationId: ORG_ID,
      mailboxCount: 0,
      createdAt: now(),
      updatedAt: now(),
    },
  ];
}

function createInitialMailboxes(): AdminMailbox[] {
  return [
    {
      id: "mbx_admin",
      email: "admin@theglobalorbit.com",
      localPart: "admin",
      domainId: "dom_theglobalorbit",
      domainName: "theglobalorbit.com",
      displayName: "Platform Admin",
      quotaMb: 10240,
      usedMb: 1280,
      status: "ACTIVE",
      aliasCount: 1,
      forwarderCount: 0,
      createdAt: now(),
    },
    {
      id: "mbx_support",
      email: "support@theglobalorbit.com",
      localPart: "support",
      domainId: "dom_theglobalorbit",
      domainName: "theglobalorbit.com",
      displayName: "Support Desk",
      quotaMb: 5120,
      usedMb: 640,
      status: "ACTIVE",
      aliasCount: 0,
      forwarderCount: 1,
      createdAt: now(),
    },
    {
      id: "mbx_sales",
      email: "sales@theglobalorbit.com",
      localPart: "sales",
      domainId: "dom_theglobalorbit",
      domainName: "theglobalorbit.com",
      displayName: "Sales",
      quotaMb: 5120,
      usedMb: 220,
      status: "ACTIVE",
      aliasCount: 0,
      forwarderCount: 0,
      createdAt: now(),
    },
  ];
}

function createInitialUsers(): AdminUser[] {
  return [
    {
      id: "usr_super",
      email: "admin@theglobalorbit.com",
      name: "Super Admin",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      organizationId: ORG_ID,
      lastLoginAt: now(),
      twoFactorEnabled: true,
      createdAt: now(),
    },
    {
      id: "usr_support",
      email: "support.ops@theglobalorbit.com",
      name: "Support Staff",
      role: "SUPPORT_STAFF",
      status: "ACTIVE",
      organizationId: ORG_ID,
      lastLoginAt: null,
      twoFactorEnabled: false,
      createdAt: now(),
    },
  ];
}

function createDns(domainId: string, domainName: string): DnsRecordView[] {
  return [
    {
      id: randomUUID(),
      domainId,
      type: "MX",
      name: domainName,
      value: "10 mail.theglobalorbit.com.",
      priority: 10,
      status: "VERIFIED",
      tone: "success",
    },
    {
      id: randomUUID(),
      domainId,
      type: "SPF",
      name: domainName,
      value: "v=spf1 mx a:mail.theglobalorbit.com ~all",
      status: "VERIFIED",
      tone: "success",
    },
    {
      id: randomUUID(),
      domainId,
      type: "DKIM",
      name: `orbit._domainkey.${domainName}`,
      value: "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
      status: "EXPECTED",
      tone: "warning",
    },
    {
      id: randomUUID(),
      domainId,
      type: "DMARC",
      name: `_dmarc.${domainName}`,
      value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@theglobalorbit.com",
      status: "MISSING",
      tone: "danger",
    },
  ];
}

function createAudit(): AuditLogEntry[] {
  return [
    {
      id: randomUUID(),
      actorEmail: "admin@theglobalorbit.com",
      action: "domain.create",
      resource: "domain",
      resourceId: "dom_theglobalorbit",
      ipAddress: "127.0.0.1",
      createdAt: now(),
    },
    {
      id: randomUUID(),
      actorEmail: "admin@theglobalorbit.com",
      action: "mailbox.create",
      resource: "mailbox",
      resourceId: "mbx_admin",
      ipAddress: "127.0.0.1",
      createdAt: now(),
    },
    {
      id: randomUUID(),
      actorEmail: "admin@theglobalorbit.com",
      action: "settings.update",
      resource: "system_setting",
      resourceId: "branding",
      ipAddress: "127.0.0.1",
      createdAt: now(),
    },
  ];
}

export interface AdminStoreState {
  domains: AdminDomain[];
  mailboxes: AdminMailbox[];
  users: AdminUser[];
  dnsRecords: DnsRecordView[];
  auditLogs: AuditLogEntry[];
  settings: Record<string, unknown>;
}

const globalStore = globalThis as unknown as {
  __goAdminStore?: AdminStoreState;
};

function createStore(): AdminStoreState {
  const domains = createInitialDomains();
  return {
    domains,
    mailboxes: createInitialMailboxes(),
    users: createInitialUsers(),
    dnsRecords: [
      ...createDns("dom_theglobalorbit", "theglobalorbit.com"),
      ...createDns("dom_mail_preview", "mail.theglobalorbit.com"),
    ],
    auditLogs: createAudit(),
    settings: {
      company: {
        name: "GLOBAL ORBIT PVT. LTD.",
        supportEmail: "support@theglobalorbit.com",
        website: "https://theglobalorbit.com",
      },
      brand: {
        product: "GLOBAL ORBIT MAIL",
        primaryColor: "#2f6fed",
        accentColor: "#d4af37",
      },
      smtp: {
        host: "mail.theglobalorbit.com",
        port: 587,
        encryption: "STARTTLS",
      },
      imap: {
        host: "mail.theglobalorbit.com",
        port: 993,
        encryption: "SSL/TLS",
      },
      security: {
        passwordMinLength: 12,
        require2faForAdmins: true,
        sessionTimeoutMinutes: 720,
      },
    },
  };
}

export function getAdminStore(): AdminStoreState {
  if (!globalStore.__goAdminStore) {
    globalStore.__goAdminStore = createStore();
  }
  return globalStore.__goAdminStore;
}

export function pushAudit(
  entry: Omit<AuditLogEntry, "id" | "createdAt"> & { createdAt?: string },
) {
  const store = getAdminStore();
  store.auditLogs.unshift({
    id: randomUUID(),
    createdAt: entry.createdAt ?? now(),
    actorEmail: entry.actorEmail,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    ipAddress: entry.ipAddress,
  });
}

export { ORG_ID, randomUUID, now };
