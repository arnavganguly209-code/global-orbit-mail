import { domainRepository } from "@/repositories/domain.repository";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import { userRepository } from "@/repositories";
import { prisma } from "@/lib/db";
import type { DashboardMetrics, MonitoringSnapshot, SystemHealthComponent } from "@/types";

async function checkDatabase(): Promise<SystemHealthComponent> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      id: "postgres",
      name: "PostgreSQL",
      status: "operational",
      detail: "Database connection healthy",
    };
  } catch {
    return {
      id: "postgres",
      name: "PostgreSQL",
      status: "down",
      detail: "Unable to reach database",
    };
  }
}

export const monitoringService = {
  async getSnapshot(): Promise<MonitoringSnapshot> {
    const database = await checkDatabase();
    const auditCount = await prisma.auditLog.count().catch(() => 0);

    return {
      cpuPercent: null,
      ramPercent: null,
      diskPercent: null,
      mailQueue: null,
      components: [
        database,
        {
          id: "api",
          name: "Admin API",
          status: "operational",
          detail: "Enterprise REST routes online",
        },
        {
          id: "application",
          name: "Application",
          status: "operational",
          detail: `Audit trail active · ${auditCount} events`,
        },
        {
          id: "postfix",
          name: "Postfix",
          status: "awaiting_integration",
          detail: "SMTP engine deferred to Phase 3",
        },
        {
          id: "dovecot",
          name: "Dovecot",
          status: "awaiting_integration",
          detail: "IMAP engine deferred to Phase 3",
        },
        {
          id: "rspamd",
          name: "Rspamd",
          status: "awaiting_integration",
          detail: "Spam filter deferred to Phase 3",
        },
      ],
      series: [],
    };
  },
};

export const dashboardService = {
  async getMetrics(): Promise<DashboardMetrics> {
    const [domains, activeDomains, mailboxes, users, storage] = await Promise.all([
      domainRepository.count(),
      domainRepository.countActive(),
      mailboxRepository.count(),
      userRepository.count(),
      mailboxRepository.storage(),
    ]);

    return {
      domains,
      activeDomains,
      mailboxes,
      users,
      storageUsedGb: Number((storage.usedMb / 1024).toFixed(2)),
      storageQuotaGb: Number((storage.quotaMb / 1024).toFixed(2)),
      spamBlocked24h: 0,
      mailQueueDepth: 0,
    };
  },
};
