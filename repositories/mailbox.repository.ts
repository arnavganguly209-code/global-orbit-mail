import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/session";
import { mapMailbox } from "@/repositories/mappers";
import type { AdminMailbox, PaginatedResult } from "@/types";
import type { MailboxStatus, Prisma } from "@prisma/client";

const mailboxInclude = {
  domain: { select: { name: true } },
  quota: true,
  _count: {
    select: {
      aliases: { where: { deletedAt: null } },
      forwarders: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.MailboxInclude;

export const mailboxRepository = {
  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<PaginatedResult<AdminMailbox>> {
    const where: Prisma.MailboxWhereInput = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { localPart: { contains: params.search, mode: "insensitive" } },
              { displayName: { contains: params.search, mode: "insensitive" } },
              { domain: { name: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.mailbox.count({ where }),
      prisma.mailbox.findMany({
        where,
        include: mailboxInclude,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return {
      items: rows.map(mapMailbox),
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
    };
  },

  async getById(id: string) {
    const mailbox = await prisma.mailbox.findFirst({
      where: { id, deletedAt: null },
      include: mailboxInclude,
    });
    return mailbox ? mapMailbox(mailbox) : null;
  },

  async create(input: {
    localPart: string;
    domainId: string;
    displayName?: string;
    quotaMb: number;
    password: string;
    actorId?: string | null;
  }) {
    const domain = await prisma.domain.findFirst({
      where: { id: input.domainId, deletedAt: null },
    });
    if (!domain) return null;

    const existing = await prisma.mailbox.findFirst({
      where: {
        domainId: input.domainId,
        localPart: input.localPart.toLowerCase(),
        deletedAt: null,
      },
    });
    if (existing) throw new Error("Mailbox already exists");

    const passwordHash = await hashPassword(input.password);
    const mailbox = await prisma.mailbox.create({
      data: {
        localPart: input.localPart.toLowerCase(),
        domainId: domain.id,
        organizationId: domain.organizationId,
        displayName: input.displayName ?? null,
        status: "PENDING",
        passwordHash,
        quota: {
          create: {
            quotaMb: input.quotaMb,
            usedMb: 0,
          },
        },
      },
      include: mailboxInclude,
    });

    await writeAudit({
      actorId: input.actorId,
      action: "mailbox.create",
      resource: "mailbox",
      resourceId: mailbox.id,
      metadata: { email: `${mailbox.localPart}@${domain.name}` },
    });

    return mapMailbox(mailbox);
  },

  async update(
    id: string,
    patch: { displayName?: string | null; status?: MailboxStatus; quotaMb?: number },
    actorId?: string | null,
  ) {
    const existing = await prisma.mailbox.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;

    const mailbox = await prisma.mailbox.update({
      where: { id },
      data: {
        displayName: patch.displayName === undefined ? undefined : patch.displayName,
        status: patch.status,
        ...(patch.quotaMb != null
          ? {
              quota: {
                upsert: {
                  create: { quotaMb: patch.quotaMb, usedMb: 0 },
                  update: { quotaMb: patch.quotaMb },
                },
              },
            }
          : {}),
      },
      include: mailboxInclude,
    });

    await writeAudit({
      actorId,
      action: "mailbox.update",
      resource: "mailbox",
      resourceId: id,
      metadata: patch,
    });

    return mapMailbox(mailbox);
  },

  async setStatus(id: string, status: MailboxStatus, actorId?: string | null) {
    return this.update(id, { status }, actorId);
  },

  async resetPassword(id: string, password: string, actorId?: string | null) {
    const existing = await prisma.mailbox.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    const passwordHash = await hashPassword(password);
    await prisma.mailbox.update({
      where: { id },
      data: { passwordHash },
    });
    await writeAudit({
      actorId,
      action: "mailbox.password_reset",
      resource: "mailbox",
      resourceId: id,
    });
    return this.getById(id);
  },

  async softDelete(id: string, actorId?: string | null) {
    const existing = await prisma.mailbox.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return false;
    await prisma.mailbox.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DISABLED" },
    });
    await writeAudit({
      actorId,
      action: "mailbox.delete",
      resource: "mailbox",
      resourceId: id,
    });
    return true;
  },

  async count() {
    return prisma.mailbox.count({ where: { deletedAt: null } });
  },

  async storage() {
    const quotas = await prisma.mailboxQuota.findMany({
      where: { mailbox: { deletedAt: null } },
    });
    return {
      usedMb: quotas.reduce((sum, q) => sum + q.usedMb, 0),
      quotaMb: quotas.reduce((sum, q) => sum + q.quotaMb, 0),
    };
  },

  async listAliases(mailboxId: string) {
    return prisma.alias.findMany({
      where: { mailboxId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async addAlias(mailboxId: string, address: string, actorId?: string | null) {
    const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId, deletedAt: null } });
    if (!mailbox) return null;
    const alias = await prisma.alias.create({
      data: { mailboxId, address: address.toLowerCase() },
    });
    await writeAudit({
      actorId,
      action: "mailbox.alias_create",
      resource: "alias",
      resourceId: alias.id,
      metadata: { mailboxId, address: alias.address },
    });
    return alias;
  },

  async removeAlias(mailboxId: string, aliasId: string, actorId?: string | null) {
    const alias = await prisma.alias.findFirst({
      where: { id: aliasId, mailboxId, deletedAt: null },
    });
    if (!alias) return false;
    await prisma.alias.update({
      where: { id: aliasId },
      data: { deletedAt: new Date() },
    });
    await writeAudit({
      actorId,
      action: "mailbox.alias_delete",
      resource: "alias",
      resourceId: aliasId,
      metadata: { mailboxId },
    });
    return true;
  },

  async listForwarders(mailboxId: string) {
    return prisma.forwarder.findMany({
      where: { mailboxId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async addForwarder(
    mailboxId: string,
    destination: string,
    keepCopy: boolean,
    actorId?: string | null,
  ) {
    const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId, deletedAt: null } });
    if (!mailbox) return null;
    const forwarder = await prisma.forwarder.create({
      data: {
        mailboxId,
        destination: destination.toLowerCase(),
        keepCopy,
      },
    });
    await writeAudit({
      actorId,
      action: "mailbox.forwarder_create",
      resource: "forwarder",
      resourceId: forwarder.id,
      metadata: { mailboxId, destination: forwarder.destination },
    });
    return forwarder;
  },

  async removeForwarder(mailboxId: string, forwarderId: string, actorId?: string | null) {
    const forwarder = await prisma.forwarder.findFirst({
      where: { id: forwarderId, mailboxId, deletedAt: null },
    });
    if (!forwarder) return false;
    await prisma.forwarder.update({
      where: { id: forwarderId },
      data: { deletedAt: new Date() },
    });
    await writeAudit({
      actorId,
      action: "mailbox.forwarder_delete",
      resource: "forwarder",
      resourceId: forwarderId,
      metadata: { mailboxId },
    });
    return true;
  },
};
