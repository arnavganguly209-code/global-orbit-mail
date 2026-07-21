import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { mapDomain } from "@/repositories/mappers";
import { buildDnsRecordsForDomain, generateDkimKeypair } from "@/lib/dns/records";
import { MailProvisioningService } from "@/services/provisioning/mail-provisioning-service";
import type { AdminDomain, PaginatedResult } from "@/types";
import type { DomainStatus, Prisma } from "@prisma/client";

export const domainRepository = {
  async list(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    organizationId?: string;
  }): Promise<PaginatedResult<AdminDomain>> {
    const where: Prisma.DomainWhereInput = {
      deletedAt: null,
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
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
    const name = input.name.toLowerCase();
    const dkim = generateDkimKeypair("orbit");

    const domain = await prisma.$transaction(async (tx) => {
      const created = await tx.domain.create({
        data: {
          name,
          organizationId: input.organizationId,
          status: "PENDING",
          sslStatus: "NONE",
          dnsStatus: "PENDING",
          mailStatus: "PROVISIONING",
          dkimSelector: dkim.selector,
          dkimPublicKey: dkim.publicKey,
          dkimPrivateKey: dkim.privateKeyPem,
        },
      });

      const records = buildDnsRecordsForDomain(created.name, {
        dkimSelector: dkim.selector,
        dkimDnsValue: dkim.dnsValue,
      });

      await tx.dnsRecord.createMany({
        data: records.map(({ purpose: _purpose, ...record }) => ({
          domainId: created.id,
          ...record,
        })),
      });

      await tx.verification.createMany({
        data: [
          {
            kind: "DNS_MX",
            state: "PENDING",
            domainId: created.id,
            organizationId: input.organizationId,
            target: created.name,
            detail: "Awaiting live MX verification",
          },
          {
            kind: "DNS_SPF",
            state: "PENDING",
            domainId: created.id,
            organizationId: input.organizationId,
            target: created.name,
            detail: "Awaiting live SPF verification",
          },
          {
            kind: "DNS_DKIM",
            state: "PENDING",
            domainId: created.id,
            organizationId: input.organizationId,
            target: `${dkim.selector}._domainkey.${created.name}`,
            detail: "Awaiting live DKIM verification",
          },
          {
            kind: "DNS_DMARC",
            state: "PENDING",
            domainId: created.id,
            organizationId: input.organizationId,
            target: `_dmarc.${created.name}`,
            detail: "Awaiting live DMARC verification",
          },
          {
            kind: "SSL",
            state: "PENDING",
            domainId: created.id,
            organizationId: input.organizationId,
            target: process.env.MAIL_HOSTNAME ?? "mail.globalorbitmail.com",
            detail: "Awaiting TLS check on mail host",
          },
        ],
      });

      return tx.domain.findFirstOrThrow({
        where: { id: created.id },
        include: { _count: { select: { mailboxes: true } } },
      });
    });

    await MailProvisioningService.provisionDomain({
      domainId: domain.id,
      domainName: domain.name,
      dkimSelector: dkim.selector,
      dkimPublicKey: dkim.publicKey,
      dkimPrivateKey: dkim.privateKeyPem,
      audit: { actorId: input.actorId },
    });

    await writeAudit({
      actorId: input.actorId,
      action: "domain.create",
      resource: "domain",
      resourceId: domain.id,
      status: "SUCCESS",
      newValue: { name: domain.name },
    });

    const fresh = await prisma.domain.findFirst({
      where: { id: domain.id, deletedAt: null },
      include: { _count: { select: { mailboxes: { where: { deletedAt: null } } } } },
    });
    if (!fresh) {
      throw new Error("Domain provisioning failed and was rolled back");
    }
    return mapDomain(fresh);
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

    await MailProvisioningService.deprovisionDomain({
      domainId: id,
      domainName: existing.name,
      audit: { actorId },
    });

    await prisma.$transaction([
      prisma.domain.update({
        where: { id },
        data: { deletedAt: new Date(), status: "SUSPENDED", mailStatus: "DISABLED" },
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
      status: "SUCCESS",
      oldValue: { name: existing.name },
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
