import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { provisionDnsForDomain } from "@/services/dns/engine";
import { mapDomain } from "@/repositories/mappers";
import type { AdminDomain, PaginatedResult } from "@/types";
import type { DomainStatus, Prisma } from "@prisma/client";

export const domainRepository = {
  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
  }): Promise<PaginatedResult<AdminDomain>> {
    const where: Prisma.DomainWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status as DomainStatus } : {}),
      ...(params.search
        ? {
            name: { contains: params.search, mode: "insensitive" },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.domain.count({ where }),
      prisma.domain.findMany({
        where,
        include: { _count: { select: { mailboxes: { where: { deletedAt: null } } } } },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return {
      items: rows.map(mapDomain),
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
    };
  },

  async getById(id: string) {
    const domain = await prisma.domain.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { mailboxes: { where: { deletedAt: null } } } } },
    });
    return domain ? mapDomain(domain) : null;
  },

  async getByName(name: string) {
    const domain = await prisma.domain.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
      include: { _count: { select: { mailboxes: { where: { deletedAt: null } } } } },
    });
    return domain ? mapDomain(domain) : null;
  },

  async create(input: {
    name: string;
    organizationId: string;
    actorId?: string | null;
  }) {
    const domain = await prisma.domain.create({
      data: {
        name: input.name.toLowerCase(),
        organizationId: input.organizationId,
        status: "PENDING",
        sslStatus: "NONE",
        dnsStatus: "PENDING",
        mailStatus: "DISABLED",
      },
      include: { _count: { select: { mailboxes: true } } },
    });

    await provisionDnsForDomain(domain.id, domain.name);
    await writeAudit({
      actorId: input.actorId,
      action: "domain.create",
      resource: "domain",
      resourceId: domain.id,
      metadata: { name: domain.name },
    });

    return mapDomain(domain);
  },

  async update(
    id: string,
    patch: Prisma.DomainUpdateInput,
    actorId?: string | null,
  ) {
    const existing = await prisma.domain.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    const domain = await prisma.domain.update({
      where: { id },
      data: patch,
      include: { _count: { select: { mailboxes: { where: { deletedAt: null } } } } },
    });
    await writeAudit({
      actorId,
      action: "domain.update",
      resource: "domain",
      resourceId: id,
      metadata: patch as object,
    });
    return mapDomain(domain);
  },

  async softDelete(id: string, actorId?: string | null) {
    const existing = await prisma.domain.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return false;
    await prisma.$transaction([
      prisma.domain.update({
        where: { id },
        data: { deletedAt: new Date(), status: "SUSPENDED" },
      }),
      prisma.dnsRecord.updateMany({
        where: { domainId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      prisma.mailbox.updateMany({
        where: { domainId: id, deletedAt: null },
        data: { deletedAt: new Date(), status: "DISABLED" },
      }),
    ]);
    await writeAudit({
      actorId,
      action: "domain.delete",
      resource: "domain",
      resourceId: id,
    });
    return true;
  },

  async count() {
    return prisma.domain.count({ where: { deletedAt: null } });
  },

  async countActive() {
    return prisma.domain.count({ where: { deletedAt: null, status: "ACTIVE" } });
  },
};
