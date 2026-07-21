import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { mapAudit, mapDnsRecord, mapUser } from "@/repositories/mappers";
import type { AdminUser, AuditLogEntry, DnsRecordView, PaginatedResult, SystemRole } from "@/types";
import type { Prisma, SystemRole as PrismaRole } from "@prisma/client";

export const userRepository = {
  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<PaginatedResult<AdminUser>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: "insensitive" } },
              { name: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: { role: true },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
    return {
      items: rows.map(mapUser),
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
    };
  },

  async create(input: {
    email: string;
    name?: string;
    role: SystemRole;
    organizationId: string;
    actorId?: string | null;
  }) {
    const role = await prisma.role.findUnique({ where: { key: input.role as PrismaRole } });
    if (!role) throw new Error("Role not found");
    const existing = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase(), deletedAt: null },
    });
    if (existing) throw new Error("User already exists");

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name ?? null,
        roleId: role.id,
        organizationId: input.organizationId,
        status: "INVITED",
      },
      include: { role: true },
    });

    await writeAudit({
      actorId: input.actorId,
      action: "user.create",
      resource: "user",
      resourceId: user.id,
      metadata: { email: user.email, role: input.role },
    });

    return mapUser(user);
  },

  async count() {
    return prisma.user.count({ where: { deletedAt: null } });
  },

  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      include: { role: true },
    });
  },

  async findByLogin(identifier: string) {
    const value = identifier.toLowerCase().trim();
    return prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: value }, { username: value }],
      },
      include: { role: true },
    });
  },
};

export const dnsRepository = {
  async listByDomain(domainId: string): Promise<DnsRecordView[]> {
    const rows = await prisma.dnsRecord.findMany({
      where: { domainId, deletedAt: null },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return rows.map(mapDnsRecord);
  },

  async listAll(): Promise<DnsRecordView[]> {
    const rows = await prisma.dnsRecord.findMany({
      where: { deletedAt: null },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return rows.map(mapDnsRecord);
  },
};

export const auditRepository = {
  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
    action?: string;
    actor?: string;
  }): Promise<PaginatedResult<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.action ? { action: params.action } : {}),
      ...(params.actor
        ? { actor: { email: { contains: params.actor, mode: "insensitive" } } }
        : {}),
      ...(params.search
        ? {
            OR: [
              { action: { contains: params.search, mode: "insensitive" } },
              { resource: { contains: params.search, mode: "insensitive" } },
              { actor: { email: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
    return {
      items: rows.map(mapAudit),
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
    };
  },

  async exportAll() {
    const rows = await prisma.auditLog.findMany({
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    return rows.map(mapAudit);
  },
};

export const settingsRepository = {
  async getAll(organizationId: string) {
    const rows = await prisma.systemSetting.findMany({
      where: { organizationId },
    });
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  },

  async update(
    organizationId: string,
    section: string,
    values: Record<string, unknown>,
    actorId?: string | null,
  ) {
    const existing = await prisma.systemSetting.findUnique({
      where: {
        organizationId_key: { organizationId, key: section },
      },
    });
    const merged = {
      ...((existing?.value as Record<string, unknown>) ?? {}),
      ...values,
    } as Prisma.InputJsonValue;
    const row = await prisma.systemSetting.upsert({
      where: {
        organizationId_key: { organizationId, key: section },
      },
      create: {
        organizationId,
        key: section,
        value: merged,
      },
      update: { value: merged },
    });
    await writeAudit({
      actorId,
      action: "settings.update",
      resource: "system_setting",
      resourceId: section,
      metadata: values as Prisma.InputJsonValue,
    });
    return row.value;
  },
};

export async function getDefaultOrganizationId() {
  const org = await prisma.organization.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!org) throw new Error("No organization seeded");
  return org.id;
}
