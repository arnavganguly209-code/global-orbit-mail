import {
  getAdminStore,
  now,
  ORG_ID,
  pushAudit,
  randomUUID,
} from "@/lib/data/admin-store";
import type { AdminMailbox, PaginatedResult } from "@/types";

export const mailboxRepository = {
  list(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): PaginatedResult<AdminMailbox> {
    const store = getAdminStore();
    let items = [...store.mailboxes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (m) =>
          m.email.toLowerCase().includes(q) ||
          (m.displayName ?? "").toLowerCase().includes(q) ||
          m.domainName.toLowerCase().includes(q),
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

  getById(id: string) {
    return getAdminStore().mailboxes.find((m) => m.id === id) ?? null;
  },

  create(input: {
    localPart: string;
    domainId: string;
    displayName?: string;
    quotaMb: number;
  }): AdminMailbox | null {
    const store = getAdminStore();
    const domain = store.domains.find((d) => d.id === input.domainId);
    if (!domain) return null;
    const email = `${input.localPart.toLowerCase()}@${domain.name}`;
    if (store.mailboxes.some((m) => m.email === email)) {
      throw new Error("Mailbox already exists");
    }
    const mailbox: AdminMailbox = {
      id: `mbx_${randomUUID().slice(0, 8)}`,
      email,
      localPart: input.localPart.toLowerCase(),
      domainId: domain.id,
      domainName: domain.name,
      displayName: input.displayName ?? null,
      quotaMb: input.quotaMb,
      usedMb: 0,
      status: "PENDING",
      aliasCount: 0,
      forwarderCount: 0,
      createdAt: now(),
    };
    store.mailboxes.unshift(mailbox);
    domain.mailboxCount += 1;
    domain.updatedAt = now();
    pushAudit({
      actorEmail: "admin@theglobalorbit.com",
      action: "mailbox.create",
      resource: "mailbox",
      resourceId: mailbox.id,
      ipAddress: "127.0.0.1",
    });
    return mailbox;
  },

  update(id: string, patch: Partial<AdminMailbox>) {
    const store = getAdminStore();
    const index = store.mailboxes.findIndex((m) => m.id === id);
    if (index < 0) return null;
    store.mailboxes[index] = { ...store.mailboxes[index], ...patch };
    pushAudit({
      actorEmail: "admin@theglobalorbit.com",
      action: "mailbox.update",
      resource: "mailbox",
      resourceId: id,
      ipAddress: "127.0.0.1",
    });
    return store.mailboxes[index];
  },

  resetPassword(id: string) {
    const mailbox = this.getById(id);
    if (!mailbox) return null;
    pushAudit({
      actorEmail: "admin@theglobalorbit.com",
      action: "mailbox.password_reset",
      resource: "mailbox",
      resourceId: id,
      ipAddress: "127.0.0.1",
    });
    return mailbox;
  },

  remove(id: string) {
    const store = getAdminStore();
    const mailbox = store.mailboxes.find((m) => m.id === id);
    if (!mailbox) return false;
    store.mailboxes = store.mailboxes.filter((m) => m.id !== id);
    const domain = store.domains.find((d) => d.id === mailbox.domainId);
    if (domain) {
      domain.mailboxCount = Math.max(0, domain.mailboxCount - 1);
      domain.updatedAt = now();
    }
    pushAudit({
      actorEmail: "admin@theglobalorbit.com",
      action: "mailbox.delete",
      resource: "mailbox",
      resourceId: id,
      ipAddress: "127.0.0.1",
    });
    return true;
  },

  count() {
    return getAdminStore().mailboxes.length;
  },

  storage() {
    const boxes = getAdminStore().mailboxes;
    return {
      usedMb: boxes.reduce((sum, m) => sum + m.usedMb, 0),
      quotaMb: boxes.reduce((sum, m) => sum + m.quotaMb, 0),
    };
  },

  orgId() {
    return ORG_ID;
  },
};
