/**
 * Configuration backups — export org/domain/mailbox metadata as JSON artifacts.
 */

import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import type { BackupJobKind, DnsRecordType, JobRunStatus } from "@prisma/client";

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
  if (!mailbox) throw new Error("Mailbox does not exist");
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

  async restore(jobId: string, actorId: string) {
    const job = await prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Backup job not found");
    if (job.status !== "SUCCEEDED" || !job.artifact) {
      throw new Error("Only succeeded backups with artifacts can be restored");
    }

    let summary: Record<string, unknown>;
    if (job.kind === "MAILBOX") {
      if (!job.mailboxId) throw new Error("Backup is missing mailboxId");
      summary = await restoreMailboxArtifact(job.artifact, job.mailboxId, actorId);
    } else if (job.kind === "DOMAIN") {
      if (!job.domainId) throw new Error("Backup is missing domainId");
      summary = await restoreDomainArtifact(job.artifact, job.domainId, actorId);
    } else if (job.kind === "ORGANIZATION") {
      if (!job.organizationId) throw new Error("Backup is missing organizationId");
      summary = await restoreOrganizationArtifact(job.artifact, job.organizationId, actorId);
    } else {
      throw new Error(
        "Platform-wide restore is not supported — restore organization, domain, or mailbox backups instead",
      );
    }

    await writeAudit({
      actorId,
      action: "backup.restore",
      resource: "backup_job",
      resourceId: job.id,
      metadata: { kind: job.kind, ...summary },
    });

    return { jobId: job.id, kind: job.kind, ...summary };
  },
};

type MailboxSnapshot = {
  id?: string;
  displayName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  website?: string | null;
  company?: string | null;
  replyTo?: string | null;
  timezone?: string | null;
  language?: string | null;
  signatureHtml?: string | null;
  signatureText?: string | null;
  avatarUrl?: string | null;
  vacationEnabled?: boolean;
  vacationSubject?: string | null;
  vacationBody?: string | null;
  vacationExpiresAt?: string | Date | null;
  quota?: { quotaMb?: number } | null;
  aliases?: Array<{ address: string }>;
  forwarders?: Array<{ destination: string; keepCopy?: boolean }>;
};

type DomainSnapshot = {
  id?: string;
  companyName?: string | null;
  brandColor?: string | null;
  dnsRecords?: Array<{
    type: DnsRecordType;
    name: string;
    value: string;
    priority?: number | null;
    ttl?: number;
    deletedAt?: string | Date | null;
  }>;
};

async function restoreMailboxArtifact(artifact: unknown, mailboxId: string, actorId: string) {
  const snap = (artifact as { mailbox?: MailboxSnapshot }).mailbox;
  if (!snap?.id || snap.id !== mailboxId) {
    throw new Error("Backup artifact does not match this mailbox");
  }

  await mailboxRepository.update(
    mailboxId,
    {
      displayName: snap.displayName ?? null,
      jobTitle: snap.jobTitle ?? null,
      department: snap.department ?? null,
      phone: snap.phone ?? null,
      website: snap.website ?? null,
      company: snap.company ?? null,
      replyTo: snap.replyTo ?? null,
      timezone: snap.timezone ?? null,
      language: snap.language ?? null,
      signatureHtml: snap.signatureHtml ?? null,
      signatureText: snap.signatureText ?? null,
      avatarUrl: snap.avatarUrl ?? null,
      vacationEnabled: Boolean(snap.vacationEnabled),
      vacationSubject: snap.vacationSubject ?? null,
      vacationBody: snap.vacationBody ?? null,
      vacationExpiresAt:
        snap.vacationExpiresAt == null
          ? null
          : new Date(snap.vacationExpiresAt),
      quotaMb: snap.quota?.quotaMb,
    },
    actorId,
  );

  const existingAliases = await mailboxRepository.listAliases(mailboxId);
  const aliasSet = new Set(existingAliases.map((a) => a.address.toLowerCase()));
  let aliasesAdded = 0;
  for (const alias of snap.aliases ?? []) {
    const address = alias.address?.trim();
    if (!address || aliasSet.has(address.toLowerCase())) continue;
    try {
      await mailboxRepository.addAlias(mailboxId, address, actorId);
      aliasSet.add(address.toLowerCase());
      aliasesAdded += 1;
    } catch {
      // skip invalid or duplicate aliases
    }
  }

  const existingForwarders = await mailboxRepository.listForwarders(mailboxId);
  const forwarderSet = new Set(existingForwarders.map((f) => f.destination.toLowerCase()));
  let forwardersAdded = 0;
  for (const forwarder of snap.forwarders ?? []) {
    const destination = forwarder.destination?.trim();
    if (!destination || forwarderSet.has(destination.toLowerCase())) continue;
    try {
      await mailboxRepository.addForwarder(
        mailboxId,
        destination,
        forwarder.keepCopy ?? true,
        actorId,
      );
      forwarderSet.add(destination.toLowerCase());
      forwardersAdded += 1;
    } catch {
      // skip invalid or duplicate forwarders
    }
  }

  return { mailboxId, aliasesAdded, forwardersAdded };
}

async function restoreDomainArtifact(artifact: unknown, domainId: string, actorId: string) {
  const snap = (artifact as { domain?: DomainSnapshot }).domain;
  if (!snap?.id || snap.id !== domainId) {
    throw new Error("Backup artifact does not match this domain");
  }

  await prisma.domain.update({
    where: { id: domainId },
    data: {
      companyName: snap.companyName ?? undefined,
      brandColor: snap.brandColor ?? undefined,
    },
  });

  let dnsRecordsAdded = 0;
  for (const record of snap.dnsRecords ?? []) {
    if (record.deletedAt) continue;
    const exists = await prisma.dnsRecord.findFirst({
      where: {
        domainId,
        type: record.type,
        name: record.name,
        value: record.value,
        deletedAt: null,
      },
    });
    if (exists) continue;
    await prisma.dnsRecord.create({
      data: {
        domainId,
        type: record.type,
        name: record.name,
        value: record.value,
        priority: record.priority ?? undefined,
        ttl: record.ttl ?? 3600,
      },
    });
    dnsRecordsAdded += 1;
  }

  await writeAudit({
    actorId,
    action: "domain.restore_from_backup",
    resource: "domain",
    resourceId: domainId,
    metadata: { dnsRecordsAdded },
  });

  return { domainId, dnsRecordsAdded };
}

async function restoreOrganizationArtifact(
  artifact: unknown,
  organizationId: string,
  actorId: string,
) {
  const root = artifact as {
    org?: { id?: string; name?: string; status?: string };
  };
  const org = root.org;
  if (!org?.id || org.id !== organizationId) {
    throw new Error("Backup artifact does not match this organization");
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(org.name ? { name: org.name } : {}),
      ...(org.status
        ? { status: org.status as "ACTIVE" | "TRIAL" | "SUSPENDED" | "ARCHIVED" }
        : {}),
    },
  });

  return { organizationId, fieldsUpdated: ["name", "status"].filter((f) => org[f as keyof typeof org]) };
}
