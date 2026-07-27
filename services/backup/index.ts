/**
 * Configuration backups — export org/domain/mailbox metadata as JSON artifacts.
 */

import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { BackupJobKind, JobRunStatus } from "@prisma/client";

async function buildPlatformSnapshot() {
  const [orgs, domains, mailboxes, plans, templates] = await Promise.all([
    prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true, type: true, status: true, createdAt: true },
    }),
    prisma.domain.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        dnsStatus: true,
        mailStatus: true,
        organizationId: true,
        companyName: true,
        brandColor: true,
      },
    }),
    prisma.mailbox.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        localPart: true,
        domainId: true,
        organizationId: true,
        displayName: true,
        status: true,
        quota: { select: { quotaMb: true, usedMb: true } },
      },
    }),
    prisma.plan.findMany(),
    prisma.emailTemplate.findMany({ select: { key: true, name: true, category: true, active: true } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    counts: { orgs: orgs.length, domains: domains.length, mailboxes: mailboxes.length },
    orgs,
    domains,
    mailboxes,
    plans,
    templates,
  };
}

async function buildOrgSnapshot(organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error("Organization not found");
  const [domains, mailboxes, subscription] = await Promise.all([
    prisma.domain.findMany({ where: { organizationId, deletedAt: null } }),
    prisma.mailbox.findMany({
      where: { organizationId, deletedAt: null },
      include: { quota: true, domain: { select: { name: true } } },
    }),
    prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    }),
  ]);
  return { exportedAt: new Date().toISOString(), org, domains, mailboxes, subscription };
}

async function buildDomainSnapshot(domainId: string) {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    include: {
      dnsRecords: { where: { deletedAt: null } },
      mailboxes: {
        where: { deletedAt: null },
        include: { quota: true },
      },
    },
  });
  if (!domain) throw new Error("Domain not found");
  return { exportedAt: new Date().toISOString(), domain };
}

async function buildMailboxSnapshot(mailboxId: string) {
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: mailboxId },
    include: {
      quota: true,
      domain: true,
      aliases: { where: { deletedAt: null } },
      forwarders: { where: { deletedAt: null } },
    },
  });
  if (!mailbox) throw new Error("Mailbox not found");
  return { exportedAt: new Date().toISOString(), mailbox };
}

export const backupService = {
  async list(params: { page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, params.pageSize ?? 20);
    const [items, total] = await Promise.all([
      prisma.backupJob.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.backupJob.count(),
    ]);
    return { items, total, page, pageSize };
  },

  async get(id: string) {
    const job = await prisma.backupJob.findUnique({ where: { id } });
    if (!job) throw new Error("Backup job not found");
    return job;
  },

  async run(
    input: {
      kind: BackupJobKind;
      organizationId?: string;
      domainId?: string;
      mailboxId?: string;
      label?: string;
    },
    actorId: string,
  ) {
    const label =
      input.label ||
      `${input.kind} backup ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;

    const job = await prisma.backupJob.create({
      data: {
        kind: input.kind,
        status: "RUNNING",
        organizationId: input.organizationId,
        domainId: input.domainId,
        mailboxId: input.mailboxId,
        label,
        createdById: actorId,
        startedAt: new Date(),
      },
    });

    try {
      let artifact: unknown;
      if (input.kind === "PLATFORM") artifact = await buildPlatformSnapshot();
      else if (input.kind === "ORGANIZATION") {
        if (!input.organizationId) throw new Error("organizationId required");
        artifact = await buildOrgSnapshot(input.organizationId);
      } else if (input.kind === "DOMAIN") {
        if (!input.domainId) throw new Error("domainId required");
        artifact = await buildDomainSnapshot(input.domainId);
      } else if (input.kind === "MAILBOX") {
        if (!input.mailboxId) throw new Error("mailboxId required");
        artifact = await buildMailboxSnapshot(input.mailboxId);
      } else {
        throw new Error("Unknown backup kind");
      }

      const json = JSON.stringify(artifact);
      const updated = await prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED" as JobRunStatus,
          artifact: artifact as object,
          sizeBytes: Buffer.byteLength(json, "utf8"),
          finishedAt: new Date(),
        },
      });

      await writeAudit({
        actorId,
        action: "backup.run",
        resource: "backup_job",
        resourceId: job.id,
        metadata: { kind: input.kind, sizeBytes: updated.sizeBytes },
      });

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backup failed";
      await prisma.backupJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      });
      throw error;
    }
  },
};
