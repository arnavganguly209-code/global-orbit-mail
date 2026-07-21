import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { mapDomain } from "@/repositories/mappers";
import { buildDnsRecordsForDomain } from "@/lib/dns/records";
import { domainLookupVariants, isValidApexDomain, normalizeApexDomain } from "@/lib/dns/domain-name";
import { getConfiguredMailHostname } from "@/lib/dns/mail-host";
import { generateDkimKeypair } from "@/lib/dns/dkim";
import { resolveMailServerIpv4, resolveMailServerIpv6 } from "@/lib/dns/mail-ip";
import { MailProvisioningService } from "@/services/provisioning/mail-provisioning-service";
import type { AdminDomain, PaginatedResult } from "@/types";
import type { DomainStatus, Prisma } from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";

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

  async getByName(name: string, organizationId?: string) {
    const apex = normalizeApexDomain(name);
    const variants = domainLookupVariants(apex);
    const domain = await prisma.domain.findFirst({
      where: {
        deletedAt: null,
        ...(organizationId ? { organizationId } : {}),
        OR: variants.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })),
      },
      include: { _count: { select: { mailboxes: { where: { deletedAt: null } } } } },
      orderBy: { createdAt: "asc" },
    });
    return domain ? mapDomain(domain) : null;
  },

  /** Includes soft-deleted rows — used for unique-safe create/restore. */
  async findAnyByOrgName(organizationId: string, name: string) {
    const apex = normalizeApexDomain(name);
    const variants = domainLookupVariants(apex);
    return prisma.domain.findFirst({
      where: {
        organizationId,
        OR: variants.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })),
      },
      include: { _count: { select: { mailboxes: { where: { deletedAt: null } } } } },
      orderBy: { createdAt: "asc" },
    });
  },

  /**
   * Idempotent domain create:
   * - normalizes to apex
   * - returns existing active domain
   * - restores soft-deleted domain
   * - creates only when missing
   * Never throws Prisma unique constraint to callers.
   */
  async createOrGet(input: {
    name: string;
    organizationId: string;
    actorId?: string | null;
  }): Promise<{ domain: AdminDomain; created: boolean; restored: boolean }> {
    const name = normalizeApexDomain(input.name);
    if (!isValidApexDomain(name)) {
      throw new Error("Invalid domain name.");
    }

    const existing = await this.findAnyByOrgName(input.organizationId, name);
    if (existing) {
      // Canonicalize www.* → apex if needed
      if (existing.name.toLowerCase() !== name) {
        try {
          await prisma.domain.update({
            where: { id: existing.id },
            data: { name },
          });
          existing.name = name;
        } catch {
          // Keep existing name if rename races another row
        }
      }

      if (!existing.deletedAt) {
        const mapped = mapDomain(existing);
        return { domain: mapped, created: false, restored: false };
      }

      // Restore soft-deleted domain
      const restored = await prisma.domain.update({
        where: { id: existing.id },
        data: {
          name,
          deletedAt: null,
          status: "PENDING",
          dnsStatus: "PENDING",
          mailStatus: "DISABLED",
          sslStatus: "NONE",
        },
        include: { _count: { select: { mailboxes: { where: { deletedAt: null } } } } },
      });

      await writeAudit({
        actorId: input.actorId,
        action: "domain.restore",
        resource: "domain",
        resourceId: restored.id,
        status: "SUCCESS",
        newValue: { name: restored.name },
      });

      return { domain: mapDomain(restored), created: false, restored: true };
    }

    try {
      const created = await this.createFresh({
        name,
        organizationId: input.organizationId,
        actorId: input.actorId,
      });
      return { domain: created, created: true, restored: false };
    } catch (error) {
      if (
        error instanceof PrismaNS.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await this.findAnyByOrgName(input.organizationId, name);
        if (raced && !raced.deletedAt) {
          return { domain: mapDomain(raced), created: false, restored: false };
        }
        throw new Error("This domain already exists in your account.");
      }
      throw error;
    }
  },

  async create(input: {
    name: string;
    organizationId: string;
    actorId?: string | null;
  }) {
    const result = await this.createOrGet(input);
    return result.domain;
  },

  async createFresh(input: {
    name: string;
    organizationId: string;
    actorId?: string | null;
  }) {
    const name = normalizeApexDomain(input.name);
    if (!isValidApexDomain(name)) {
      throw new Error("Invalid domain name.");
    }
    const dkim = generateDkimKeypair("orbit");
    const mailIpv4 = await resolveMailServerIpv4();
    const mailIpv6 = await resolveMailServerIpv6();

    const domain = await prisma.$transaction(async (tx) => {
      const created = await tx.domain.create({
        data: {
          name,
          organizationId: input.organizationId,
          status: "PENDING",
          sslStatus: "NONE",
          dnsStatus: "PENDING",
          mailStatus: "DISABLED",
          dkimSelector: dkim.selector,
          dkimPublicKey: dkim.publicKey,
          dkimPrivateKey: dkim.privateKeyPem,
        },
      });

      const records = buildDnsRecordsForDomain(created.name, {
        dkimSelector: dkim.selector,
        dkimDnsValue: dkim.dnsValue,
        mailIpv4,
        mailIpv6,
      });

      await tx.dnsRecord.createMany({
        data: records.map(
          ({ purpose: _purpose, label: _label, publishType: _publishType, host: _host, ...record }) => ({
            domainId: created.id,
            ...record,
          }),
        ),
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
            target: getConfiguredMailHostname(),
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
      throw new Error("Unable to save domain. Please try again.");
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
