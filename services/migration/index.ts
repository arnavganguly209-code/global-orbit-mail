/**
 * IMAP migration — import mail from external source into target mailbox.
 */

import { z } from "zod";
import { ImapFlow } from "imapflow";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  kind: z.enum(["IMAP_IMPORT", "DOMAIN_CUTOVER", "MAILBOX_MOVE"]).default("IMAP_IMPORT"),
  organizationId: z.string().uuid().optional(),
  sourceHost: z.string().min(1),
  sourcePort: z.number().int().positive().default(993),
  sourceEmail: z.string().email().optional(),
  targetEmail: z.string().email(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const runSchema = z.object({
  sourcePassword: z.string().min(1),
  targetPassword: z.string().min(1),
  sourceEmail: z.string().email().optional(),
  useTls: z.boolean().default(true),
});

async function resolveTargetMailbox(targetEmail: string) {
  const [localPart, domainName] = targetEmail.toLowerCase().split("@");
  if (!localPart || !domainName) throw new Error("Invalid target email");

  const mb = await prisma.mailbox.findFirst({
    where: {
      deletedAt: null,
      localPart,
      domain: { name: domainName, deletedAt: null },
    },
    include: { domain: true },
  });

  if (!mb) throw new Error("Mailbox does not exist");
  if (mb.status !== "ACTIVE") throw new Error("Target mailbox is not active");
  return `${mb.localPart}@${mb.domain.name}`;
}

async function copyFolder(
  source: ImapFlow,
  target: ImapFlow,
  folderPath: string,
  onProgress: (copied: number) => void,
) {
  let copied = 0;
  const lock = await source.getMailboxLock(folderPath);
  try {
    const mailbox = source.mailbox as { exists?: number } | false | null | undefined;
    const total = mailbox && typeof mailbox === "object" ? Number(mailbox.exists ?? 0) : 0;
    if (total === 0) return 0;

    try {
      await target.mailboxCreate(folderPath);
    } catch {
      /* exists */
    }

    const tLock = await target.getMailboxLock(folderPath);
    try {
      for await (const msg of source.fetch("1:*", { uid: true, source: true }, { uid: true })) {
        if (!msg.source) continue;
        await target.append(folderPath, msg.source, []);
        copied++;
        onProgress(copied);
      }
    } finally {
      tLock.release();
    }
  } finally {
    lock.release();
  }
  return copied;
}

export const migrationService = {
  async list(params: { page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, params.pageSize ?? 20);
    const [items, total] = await Promise.all([
      prisma.migrationJob.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.migrationJob.count(),
    ]);
    return { items, total, page, pageSize };
  },

  async get(id: string) {
    const job = await prisma.migrationJob.findUnique({ where: { id } });
    if (!job) throw new Error("Migration job not found");
    return job;
  },

  async create(body: unknown, actorId: string) {
    const input = createSchema.parse(body);
    const job = await prisma.migrationJob.create({
      data: {
        kind: input.kind,
        organizationId: input.organizationId,
        sourceHost: input.sourceHost,
        sourcePort: input.sourcePort,
        sourceEmail: input.sourceEmail,
        targetEmail: input.targetEmail,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        createdById: actorId,
        status: "QUEUED",
      },
    });
    await writeAudit({
      actorId,
      action: "migration.create",
      resource: "migration_job",
      resourceId: job.id,
    });
    return job;
  },

  async cancel(id: string, actorId: string) {
    const job = await prisma.migrationJob.findUnique({ where: { id } });
    if (!job) throw new Error("Migration job not found");
    if (job.status === "RUNNING") throw new Error("Cannot cancel running job");
    const updated = await prisma.migrationJob.update({
      where: { id },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
    await writeAudit({ actorId, action: "migration.cancel", resource: "migration_job", resourceId: id });
    return updated;
  },

  async run(id: string, body: unknown, actorId: string) {
    const creds = runSchema.parse(body);
    const job = await prisma.migrationJob.findUnique({ where: { id } });
    if (!job) throw new Error("Migration job not found");
    if (job.status === "RUNNING") throw new Error("Migration already running");
    if (job.status === "SUCCEEDED") throw new Error("Migration already completed");

    const sourceEmail = creds.sourceEmail || job.sourceEmail;
    if (!sourceEmail) throw new Error("Source email required");

    const targetEmail = await resolveTargetMailbox(job.targetEmail);

    await prisma.migrationJob.update({
      where: { id },
      data: { status: "RUNNING", startedAt: new Date(), progress: 0, error: null },
    });

    const source = new ImapFlow({
      host: job.sourceHost,
      port: job.sourcePort,
      secure: creds.useTls,
      auth: { user: sourceEmail, pass: creds.sourcePassword },
      logger: false,
    });

    const targetClient = new ImapFlow({
      host: process.env.IMAP_HOST || "127.0.0.1",
      port: Number(process.env.IMAP_PORT || 993),
      secure: true,
      auth: { user: targetEmail, pass: creds.targetPassword },
      logger: false,
    });

    let totalCopied = 0;

    try {
      await source.connect();
      await targetClient.connect();

      const folders = await source.list();
      const selectable = folders.filter((f) => !f.flags?.has("\\Noselect"));
      const totalFolders = selectable.length || 1;
      let folderIndex = 0;

      for (const box of selectable) {
        const copied = await copyFolder(source, targetClient, box.path, (n) => {
          totalCopied = n;
        });
        totalCopied += copied;
        folderIndex++;
        const progress = Math.min(99, Math.round((folderIndex / totalFolders) * 100));
        await prisma.migrationJob.update({
          where: { id },
          data: {
            progress,
            metadata: {
              ...(typeof job.metadata === "object" && job.metadata ? job.metadata : {}),
              lastFolder: box.path,
              messagesCopied: totalCopied,
            },
          },
        });
      }

      const updated = await prisma.migrationJob.update({
        where: { id },
        data: {
          status: "SUCCEEDED",
          progress: 100,
          finishedAt: new Date(),
          metadata: {
            ...(typeof job.metadata === "object" && job.metadata ? job.metadata : {}),
            messagesCopied: totalCopied,
            foldersProcessed: selectable.length,
          },
        },
      });

      await writeAudit({
        actorId,
        action: "migration.run",
        resource: "migration_job",
        resourceId: id,
        metadata: { messagesCopied: totalCopied },
      });

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Migration failed";
      await prisma.migrationJob.update({
        where: { id },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      });
      throw error;
    } finally {
      try {
        await source.logout();
      } catch {
        /* ignore */
      }
      try {
        await targetClient.logout();
      } catch {
        /* ignore */
      }
    }
  },
};
