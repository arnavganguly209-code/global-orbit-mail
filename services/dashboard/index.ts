import { domainRepository } from "@/repositories/domain.repository";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import { userRepository } from "@/repositories";
import { prisma } from "@/lib/db";
import { systemHealthService } from "@/services/system/health";
import type {
  AuditLogEntry,
  DashboardMetrics,
  MonitoringSnapshot,
  SystemHealthComponent,
} from "@/types";

function mapHealthStatus(
  status: string,
): SystemHealthComponent["status"] {
  if (status === "operational") return "operational";
  if (status === "degraded") return "degraded";
  if (status === "down") return "down";
  return "awaiting_integration";
}

export const monitoringService = {
  async getSnapshot(): Promise<MonitoringSnapshot> {
    const report = await systemHealthService.getReport(null, { audit: false });
    return {
      cpuPercent: report.cpuPercent,
      ramPercent: report.ramPercent,
      diskPercent: report.diskPercent,
      mailQueue: null,
      components: report.components.map((c) => ({
        id: c.id,
        name: c.name,
        status: mapHealthStatus(c.status),
        detail: c.detail,
      })),
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
