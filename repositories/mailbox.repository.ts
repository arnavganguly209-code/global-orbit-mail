import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { mapMailbox } from "@/repositories/mappers";
import { hashMailboxPassword } from "@/services/provisioning/password";
import { mailEngine } from "@/services/provisioning/mail-engine";
import { MailProvisioningService } from "@/services/provisioning/mail-provisioning-service";
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
    organizationId?: string;
  }): Promise<PaginatedResult<AdminMailbox>> {
    const where: Prisma.MailboxWhereInput = {
      deletedAt: null,
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
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

    const { passwordHash, mailPasswordHash } = await hashMailboxPassword(input.password);
    const email = `${input.localPart.toLowerCase()}@${domain.name}`;

    const mailbox = await prisma.mailbox.create({
      data: {
        localPart: input.localPart.toLowerCase(),
        domainId: domain.id,
        organizationId: domain.organizationId,
        displayName: input.displayName ?? null,
        status: "ACTIVE",
        passwordHash,
        mailPasswordHash,
        quota: {
          create: {
            quotaMb: input.quotaMb,
            usedMb: 0,
          },
        },
      },
      include: mailboxInclude,
    });

    try {
      await MailProvisioningService.provisionMailbox({
        mailboxId: mailbox.id,
        domainId: domain.id,
        email,
        mailPasswordHash,
        quotaBytes: input.quotaMb * 1024 * 1024,
        displayName: input.displayName ?? null,
        audit: { actorId: input.actorId },
      });
    } catch (error) {
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { status: "DISABLED" },
      });
      throw error instanceof Error
        ? error
        : new Error("Mailbox provisioning failed. Please try again.");
    }

    await writeAudit({
      actorId: input.actorId,
      action: "mailbox.create",
      resource: "mailbox",
      resourceId: mailbox.id,
      status: "SUCCESS",
      newValue: { email, quotaMb: input.quotaMb, displayName: input.displayName ?? null },
    });

    return this.getById(mailbox.id);
  },

  async update(
    id: string,
    patch: {
      displayName?: string | null;
      status?: MailboxStatus;
      quotaMb?: number;
      vacationEnabled?: boolean;
      vacationSubject?: string | null;
      vacationBody?: string | null;
      vacationExpiresAt?: Date | null;
    },
    actorId?: string | null,
  ) {
    const existing = await prisma.mailbox.findFirst({
      where: { id, deletedAt: null },
      include: { domain: true, quota: true },
    });
    if (!existing) return null;

    const email = `${existing.localPart}@${existing.domain.name}`;

    const mailbox = await prisma.mailbox.update({
      where: { id },
      data: {
        displayName: patch.displayName === undefined ? undefined : patch.displayName,
        status: patch.status,
        vacationEnabled: patch.vacationEnabled,
        vacationSubject: patch.vacationSubject === undefined ? undefined : patch.vacationSubject,
        vacationBody: patch.vacationBody === undefined ? undefined : patch.vacationBody,
        vacationExpiresAt:
          patch.vacationExpiresAt === undefined ? undefined : patch.vacationExpiresAt,
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

    if (patch.quotaMb != null) {
      await MailProvisioningService.updateQuota({
        mailboxId: id,
        domainId: existing.domainId,
        email,
        quotaBytes: patch.quotaMb * 1024 * 1024,
        audit: { actorId },
      });
    }

    if (
      patch.vacationEnabled !== undefined ||
      patch.vacationSubject !== undefined ||
      patch.vacationBody !== undefined ||
      patch.vacationExpiresAt !== undefined
    ) {
      // Vacation sync stays on mailEngine until MailProvisioningService adds VACATION_SYNC.
      await mailEngine.runTracked({
        kind: "VACATION_SYNC",
        command: "vacation.sync",
        mailboxId: id,
        domainId: existing.domainId,
        payload: {
          email,
          enabled: mailbox.vacationEnabled,
          subject: mailbox.vacationSubject,
          body: mailbox.vacationBody,
          expiresAt: mailbox.vacationExpiresAt?.toISOString() ?? null,
        },
      });
    }

    await writeAudit({
      actorId,
      action: "mailbox.update",
      resource: "mailbox",
      resourceId: id,
      status: "SUCCESS",
      oldValue: {
        displayName: existing.displayName,
        status: existing.status,
        quotaMb: existing.quota?.quotaMb ?? null,
        vacationEnabled: existing.vacationEnabled,
      },
      newValue: patch,
    });

    return mapMailbox(mailbox);
  },

  async setStatus(id: string, status: MailboxStatus, actorId?: string | null) {
    const existing = await prisma.mailbox.findFirst({
      where: { id, deletedAt: null },
      include: { domain: true },
    });
    if (!existing) return null;

    const email = `${existing.localPart}@${existing.domain.name}`;
    const active = status === "ACTIVE";

    await MailProvisioningService.setMailboxActive({
      mailboxId: id,
      domainId: existing.domainId,
      email,
      active,
      audit: { actorId },
    });

    await writeAudit({
      actorId,
      action: active ? "mailbox.unsuspend" : "mailbox.suspend",
      resource: "mailbox",
      resourceId: id,
      status: "SUCCESS",
      oldValue: { status: existing.status, email },
      newValue: { status, email, active },
    });

    return this.update(id, { status }, actorId);
  },

  async resetPassword(id: string, password: string, actorId?: string | null) {
    const existing = await prisma.mailbox.findFirst({
      where: { id, deletedAt: null },
      include: { domain: true },
    });
    if (!existing) return null;

    const { passwordHash, mailPasswordHash } = await hashMailboxPassword(password);
    const email = `${existing.localPart}@${existing.domain.name}`;

    await prisma.mailbox.update({
      where: { id },
      data: { passwordHash, mailPasswordHash },
    });

    await MailProvisioningService.updatePassword({
      mailboxId: id,
      domainId: existing.domainId,
      email,
      mailPasswordHash,
      audit: { actorId },
    });

    await writeAudit({
      actorId,
      action: "mailbox.password_reset",
      resource: "mailbox",
      resourceId: id,
      status: "SUCCESS",
      newValue: { email, passwordChanged: true },
    });
    return this.getById(id);
  },

  async softDelete(id: string, actorId?: string | null) {
    const existing = await prisma.mailbox.findFirst({
      where: { id, deletedAt: null },
      include: { domain: true },
    });
    if (!existing) return false;

    const email = `${existing.localPart}@${existing.domain.name}`;
    await MailProvisioningService.deprovisionMailbox({
      mailboxId: id,
      domainId: existing.domainId,
      email,
      audit: { actorId },
    });

    await prisma.$transaction([
      prisma.mailbox.update({
        where: { id },
        data: { deletedAt: new Date(), status: "DISABLED" },
      }),
      prisma.alias.updateMany({
        where: { mailboxId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      prisma.forwarder.updateMany({
        where: { mailboxId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);
    await writeAudit({
      actorId,
      action: "mailbox.delete",
      resource: "mailbox",
      resourceId: id,
      status: "SUCCESS",
      oldValue: { email, status: existing.status },
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
    const mailbox = await prisma.mailbox.findFirst({
      where: { id: mailboxId, deletedAt: null },
      include: { domain: true },
    });
    if (!mailbox) return null;
    const alias = await prisma.alias.create({
      data: { mailboxId, address: address.toLowerCase() },
    });
    const goto = `${mailbox.localPart}@${mailbox.domain.name}`;
    await MailProvisioningService.syncAlias({
      mailboxId,
      domainId: mailbox.domainId,
      address: alias.address,
      goto,
      audit: { actorId },
    });
    await writeAudit({
      actorId,
      action: "mailbox.alias_create",
      resource: "alias",
      resourceId: alias.id,
      status: "SUCCESS",
      newValue: { mailboxId, address: alias.address, goto },
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
      status: "SUCCESS",
      oldValue: { mailboxId, address: alias.address },
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
    const mailbox = await prisma.mailbox.findFirst({
      where: { id: mailboxId, deletedAt: null },
      include: { domain: true },
    });
    if (!mailbox) return null;
    const forwarder = await prisma.forwarder.create({
      data: {
        mailboxId,
        destination: destination.toLowerCase(),
        keepCopy,
      },
    });
    const primary = `${mailbox.localPart}@${mailbox.domain.name}`;
    const goto = keepCopy ? `${primary},${forwarder.destination}` : forwarder.destination;
    await MailProvisioningService.syncForwarder({
      mailboxId,
      domainId: mailbox.domainId,
      address: primary,
      goto,
      audit: { actorId },
    });
    await writeAudit({
      actorId,
      action: "mailbox.forwarder_create",
      resource: "forwarder",
      resourceId: forwarder.id,
      status: "SUCCESS",
      newValue: {
        mailboxId,
        destination: forwarder.destination,
        keepCopy,
        address: primary,
        goto,
      },
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
      status: "SUCCESS",
      oldValue: { mailboxId, destination: forwarder.destination },
    });
    return true;
  },
};
