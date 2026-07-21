import { getAdminStore, pushAudit, randomUUID, now, ORG_ID } from "@/lib/data/admin-store";
import type { AdminUser, AuditLogEntry, DnsRecordView, PaginatedResult } from "@/types";

export const userRepository = {
  list(params: { page: number; pageSize: number; search?: string }): PaginatedResult<AdminUser> {
    const store = getAdminStore();
    let items = [...store.users];
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name ?? "").toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q),
      );
    }
    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    return {
      items: items.slice(start, start + params.pageSize),
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: start + params.pageSize < total,
    };
  },

  create(input: { email: string; name?: string; role: AdminUser["role"] }): AdminUser {
    const store = getAdminStore();
    if (store.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("User already exists");
    }
    const user: AdminUser = {
      id: `usr_${randomUUID().slice(0, 8)}`,
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      role: input.role,
      status: "INVITED",
      organizationId: ORG_ID,
      lastLoginAt: null,
      twoFactorEnabled: false,
      createdAt: now(),
    };
    store.users.unshift(user);
    pushAudit({
      actorEmail: "admin@theglobalorbit.com",
      action: "user.create",
      resource: "user",
      resourceId: user.id,
      ipAddress: "127.0.0.1",
    });
    return user;
  },

  count() {
    return getAdminStore().users.length;
  },
};

export const dnsRepository = {
  listByDomain(domainId: string): DnsRecordView[] {
    return getAdminStore().dnsRecords.filter((r) => r.domainId === domainId);
  },

  listAll(): DnsRecordView[] {
    return getAdminStore().dnsRecords;
  },
};

export const auditRepository = {
  list(params: {
    page: number;
    pageSize: number;
    search?: string;
    action?: string;
    actor?: string;
  }): PaginatedResult<AuditLogEntry> {
    const store = getAdminStore();
    let items = [...store.auditLogs];
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.resource.toLowerCase().includes(q) ||
          (l.actorEmail ?? "").toLowerCase().includes(q),
      );
    }
    if (params.action) items = items.filter((l) => l.action === params.action);
    if (params.actor) {
      items = items.filter((l) => (l.actorEmail ?? "").includes(params.actor!));
    }
    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    return {
      items: items.slice(start, start + params.pageSize),
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: start + params.pageSize < total,
    };
  },

  exportAll() {
    return getAdminStore().auditLogs;
  },
};

export const settingsRepository = {
  getAll() {
    return getAdminStore().settings;
  },
  update(section: string, values: Record<string, unknown>) {
    const store = getAdminStore();
    store.settings[section] = {
      ...(store.settings[section] as Record<string, unknown>),
      ...values,
    };
    pushAudit({
      actorEmail: "admin@theglobalorbit.com",
      action: "settings.update",
      resource: "system_setting",
      resourceId: section,
      ipAddress: "127.0.0.1",
    });
    return store.settings[section];
  },
};
