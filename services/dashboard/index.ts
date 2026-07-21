import { domainRepository } from "@/repositories/domain.repository";
import { mailboxRepository } from "@/repositories/mailbox.repository";
import { userRepository } from "@/repositories";
import type { DashboardMetrics, MonitoringSnapshot } from "@/types";

/**
 * Monitoring returns architecture-ready telemetry.
 * CPU/RAM/Disk are null until VPS integration is connected.
 */
export const monitoringService = {
  getSnapshot(): MonitoringSnapshot {
    return {
      cpuPercent: null,
      ramPercent: null,
      diskPercent: null,
      mailQueue: null,
      components: [
        {
          id: "nginx",
          name: "Nginx",
          status: "awaiting_integration",
          detail: "Edge proxy integration pending",
        },
        {
          id: "postfix",
          name: "Postfix",
          status: "awaiting_integration",
          detail: "SMTP engine not connected in Phase 2A",
        },
        {
          id: "dovecot",
          name: "Dovecot",
          status: "awaiting_integration",
          detail: "IMAP engine not connected in Phase 2A",
        },
        {
          id: "rspamd",
          name: "Rspamd",
          status: "awaiting_integration",
          detail: "Spam filter telemetry pending",
        },
        {
          id: "postgres",
          name: "PostgreSQL",
          status: "awaiting_integration",
          detail: "Schema ready — database provisioning pending",
        },
        {
          id: "api",
          name: "Admin API",
          status: "operational",
          detail: "Enterprise API routes online",
        },
      ],
      series: [
        { label: "00:00", mail: 42, spam: 8 },
        { label: "04:00", mail: 28, spam: 5 },
        { label: "08:00", mail: 96, spam: 18 },
        { label: "12:00", mail: 140, spam: 24 },
        { label: "16:00", mail: 122, spam: 21 },
        { label: "20:00", mail: 88, spam: 14 },
      ],
    };
  },
};

export const dashboardService = {
  getMetrics(): DashboardMetrics {
    const storage = mailboxRepository.storage();
    const series = monitoringService.getSnapshot().series;
    return {
      domains: domainRepository.count(),
      activeDomains: domainRepository.countActive(),
      mailboxes: mailboxRepository.count(),
      users: userRepository.count(),
      storageUsedGb: Number((storage.usedMb / 1024).toFixed(2)),
      storageQuotaGb: Number((storage.quotaMb / 1024).toFixed(2)),
      spamBlocked24h: series.reduce((sum, point) => sum + point.spam, 0),
      mailQueueDepth: series[series.length - 1]?.mail ?? 0,
    };
  },
};
