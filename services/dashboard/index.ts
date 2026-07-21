import { domainRepository } from "@/repositories/domain.repository";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import { userRepository } from "@/repositories";
import { prisma } from "@/lib/db";
import type {
  AuditLogEntry,
  DashboardMetrics,
  MonitoringSnapshot,
  SystemHealthComponent,
} from "@/types";

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
          detail: "SMTP engine deferred to Phase 3B",
        },
        {
          id: "dovecot",
          name: "Dovecot",
          status: "awaiting_integration",
          detail: "IMAP engine deferred to Phase 3B",
        },
        {
          id: "rspamd",
          name: "Rspamd",
          status: "awaiting_integration",
          detail: "Spam filter deferred to Phase 3B",
        },
      ],
      series: [],
    };
  },
};

export const dashboardService = {
  async getMetrics(): Promise<DashboardMetrics> {
    const [
      domains,
      activeDomains,
      mailboxes,
      users,
      storage,
      aliases,
      forwarders,
      auditLogs,
      notifications,
      unreadNotifications,
    ] = await Promise.all([
      domainRepository.count(),
      domainRepository.countActive(),
      mailboxRepository.count(),
      userRepository.count(),
      mailboxRepository.storage(),
      prisma.alias.count({ where: { deletedAt: null } }),
      prisma.forwarder.count({ where: { deletedAt: null } }),
      prisma.auditLog.count(),
      prisma.notification.count(),
      prisma.notification.count({ where: { read: false } }),
    ]);

    return {
      domains,
      activeDomains,
      mailboxes,
      users,
      aliases,
      forwarders,
      auditLogs,
      notifications,
      unreadNotifications,
      storageUsedGb: Number((storage.usedMb / 1024).toFixed(2)),
      storageQuotaGb: Number((storage.quotaMb / 1024).toFixed(2)),
      spamBlocked24h: 0,
      mailQueueDepth: 0,
    };
  },

  async getRecentActivity(limit = 12): Promise<AuditLogEntry[]> {
    const rows = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      actorEmail: r.actor?.email ?? null,
      action: r.action,
      resource: r.resource,
      resourceId: r.resourceId,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    }));
  },

  async getRecentNotifications(userId: string, limit = 8) {
    return prisma.notification.findMany({
      where: {
        OR: [{ userId }, { userId: null }],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
