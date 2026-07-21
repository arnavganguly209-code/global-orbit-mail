import {
  getAdminStore,
  now,
  ORG_ID,
  pushAudit,
  randomUUID,
} from "@/lib/data/admin-store";
import type { AdminDomain, PaginatedResult } from "@/types";

function matchesSearch(domain: AdminDomain, search: string) {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    domain.name.toLowerCase().includes(q) ||
    domain.status.toLowerCase().includes(q) ||
    domain.dnsStatus.toLowerCase().includes(q)
  );
}

export const domainRepository = {
  list(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
  }): PaginatedResult<AdminDomain> {
    const store = getAdminStore();
    let items = [...store.domains].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (params.search) items = items.filter((d) => matchesSearch(d, params.search!));
    if (params.status) items = items.filter((d) => d.status === params.status);
    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    const pageItems = items.slice(start, start + params.pageSize);
    return {
      items: pageItems,
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: start + params.pageSize < total,
    };
  },

  getById(id: string) {
    return getAdminStore().domains.find((d) => d.id === id) ?? null;
  },

  getByName(name: string) {
    return (
      getAdminStore().domains.find((d) => d.name.toLowerCase() === name.toLowerCase()) ??
      null
    );
  },

  create(name: string): AdminDomain {
    const store = getAdminStore();
    const domain: AdminDomain = {
      id: `dom_${randomUUID().slice(0, 8)}`,
      name: name.toLowerCase(),
      status: "PENDING",
      sslStatus: "NONE",
      dnsStatus: "UNKNOWN",
      mailStatus: "DISABLED",
      organizationId: ORG_ID,
      mailboxCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    store.domains.unshift(domain);
    store.dnsRecords.push(
      {
        id: randomUUID(),
        domainId: domain.id,
        type: "MX",
        name: domain.name,
        value: "10 mail.theglobalorbit.com.",
        priority: 10,
        status: "EXPECTED",
        tone: "warning",
      },
      {
        id: randomUUID(),
        domainId: domain.id,
        type: "SPF",
        name: domain.name,
        value: "v=spf1 mx a:mail.theglobalorbit.com ~all",
        status: "EXPECTED",
        tone: "warning",
      },
      {
        id: randomUUID(),
        domainId: domain.id,
        type: "DKIM",
        name: `orbit._domainkey.${domain.name}`,
        value: "v=DKIM1; k=rsa; p=PENDING_KEY_MATERIAL",
        status: "EXPECTED",
        tone: "warning",
      },
      {
        id: randomUUID(),
        domainId: domain.id,
        type: "DMARC",
        name: `_dmarc.${domain.name}`,
        value: "v=DMARC1; p=none; rua=mailto:dmarc@theglobalorbit.com",
        status: "EXPECTED",
        tone: "warning",
      },
    );
    pushAudit({
      actorEmail: "admin@theglobalorbit.com",
      action: "domain.create",
      resource: "domain",
      resourceId: domain.id,
      ipAddress: "127.0.0.1",
    });
    return domain;
  },

  update(id: string, patch: Partial<AdminDomain>) {
    const store = getAdminStore();
    const index = store.domains.findIndex((d) => d.id === id);
    if (index < 0) return null;
    store.domains[index] = {
      ...store.domains[index],
      ...patch,
      updatedAt: now(),
    };
    pushAudit({
      actorEmail: "admin@theglobalorbit.com",
      action: "domain.update",
      resource: "domain",
      resourceId: id,
      ipAddress: "127.0.0.1",
    });
    return store.domains[index];
  },

  remove(id: string) {
    const store = getAdminStore();
    const exists = store.domains.some((d) => d.id === id);
    if (!exists) return false;
    store.domains = store.domains.filter((d) => d.id !== id);
    store.mailboxes = store.mailboxes.filter((m) => m.domainId !== id);
    store.dnsRecords = store.dnsRecords.filter((r) => r.domainId !== id);
    pushAudit({
      actorEmail: "admin@theglobalorbit.com",
      action: "domain.delete",
      resource: "domain",
      resourceId: id,
      ipAddress: "127.0.0.1",
    });
    return true;
  },

  count() {
    return getAdminStore().domains.length;
  },

  countActive() {
    return getAdminStore().domains.filter((d) => d.status === "ACTIVE").length;
  },
};
