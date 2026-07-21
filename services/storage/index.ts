import { prisma } from "@/lib/db";
import { mailEngine } from "@/services/provisioning/mail-engine";
import { writeAudit } from "@/lib/audit";

export type MailboxStorageRow = {
  mailboxId: string;
  email: string;
  quotaMb: number;
  usedMb: number;
  percent: number;
  status: string;
};

export type StorageReport = {
  usedMb: number;
  quotaMb: number;
  percent: number;
  mailboxCount: number;
  mailboxes: MailboxStorageRow[];
  syncedFromAgent: boolean;
  checkedAt: string;
};

function percent(used: number, quota: number): number {
  if (quota <= 0) return 0;
  return Number(Math.min(100, (used / quota) * 100).toFixed(2));
}

export const storageService = {
  async getReport(options?: {
    organizationId?: string;
    mailboxId?: string;
    actorId?: string | null;
    syncFromAgent?: boolean;
  }): Promise<StorageReport> {
    const where = {
      deletedAt: null as Date | null,
      ...(options?.organizationId ? { organizationId: options.organizationId } : {}),
      ...(options?.mailboxId ? { id: options.mailboxId } : {}),
    };

    const mailboxes = await prisma.mailbox.findMany({
      where,
      include: {
        domain: { select: { name: true } },
        quota: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    let syncedFromAgent = false;

    if (options?.syncFromAgent !== false && mailEngine.isEnabled()) {
      for (const mailbox of mailboxes.slice(0, 200)) {
        const email = `${mailbox.localPart}@${mailbox.domain.name}`;
        const result = await mailEngine.runTracked({
          kind: "STORAGE_SYNC",
          command: "storage.usage",
          mailboxId: mailbox.id,
          domainId: mailbox.domainId,
          payload: { email },
        });
        if (result.ok && result.data && typeof result.data.usedBytes === "number") {
          const usedMb = Math.max(0, Math.ceil(Number(result.data.usedBytes) / (1024 * 1024)));
          await prisma.mailboxQuota.upsert({
            where: { mailboxId: mailbox.id },
            create: {
              mailboxId: mailbox.id,
              quotaMb: mailbox.quota?.quotaMb ?? 2048,
              usedMb,
            },
            update: { usedMb },
          });
          syncedFromAgent = true;
        }
      }

      // Reload after sync
      if (syncedFromAgent) {
        const refreshed = await prisma.mailbox.findMany({
          where,
          include: {
            domain: { select: { name: true } },
            quota: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5000,
        });
        mailboxes.splice(0, mailboxes.length, ...refreshed);
      }
    }

    const rows: MailboxStorageRow[] = mailboxes.map((m) => {
      const quotaMb = m.quota?.quotaMb ?? 0;
      const usedMb = m.quota?.usedMb ?? 0;
      return {
        mailboxId: m.id,
        email: `${m.localPart}@${m.domain.name}`,
        quotaMb,
        usedMb,
        percent: percent(usedMb, quotaMb),
        status: m.status,
      };
    });

    const usedMb = rows.reduce((sum, r) => sum + r.usedMb, 0);
    const quotaMb = rows.reduce((sum, r) => sum + r.quotaMb, 0);

    if (syncedFromAgent) {
      await writeAudit({
        actorId: options?.actorId,
        action: "storage.report",
        resource: "storage",
        metadata: { usedMb, quotaMb, mailboxCount: rows.length, syncedFromAgent },
      });
    }

    return {
      usedMb,
      quotaMb,
      percent: percent(usedMb, quotaMb),
      mailboxCount: rows.length,
      mailboxes: rows,
      syncedFromAgent,
      checkedAt: new Date().toISOString(),
    };
  },
};
