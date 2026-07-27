/**
 * Spam / deliverability admin metrics.
 */

import { prisma } from "@/lib/db";
import { getMailTrafficSeries } from "@/lib/mail/daily-stats";
import { systemHealthService } from "@/services/system/health";

export const spamAdminService = {
  async getOverview() {
    const [traffic, rspamd, recentSpamAudits] = await Promise.all([
      getMailTrafficSeries(14),
      systemHealthService.getReport(null, { audit: false }),
      prisma.auditLog.findMany({
        where: { action: { in: ["webmail.spam", "message.spam"] } },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { actor: { select: { email: true } } },
      }),
    ]);

    const rspamdComponent = rspamd.components.find((c) => c.id === "rspamd");
    const spam14d = traffic.reduce((s, t) => s + t.spam, 0);
    const sent14d = traffic.reduce((s, t) => s + t.mail, 0);

    return {
      rspamd: rspamdComponent ?? { id: "rspamd", name: "Rspamd", status: "unknown", detail: null },
      stats: {
        spamActions14d: spam14d,
        sent14d,
        spamRate: sent14d > 0 ? Math.round((spam14d / sent14d) * 1000) / 10 : 0,
      },
      traffic,
      recentActions: recentSpamAudits.map((a) => ({
        id: a.id,
        actorEmail: a.actor?.email ?? null,
        action: a.action,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  },
};
