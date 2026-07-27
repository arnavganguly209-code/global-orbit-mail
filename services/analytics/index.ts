/**
 * Orbit Analytics — production metrics from DB + mail daily stats.
 */

import { prisma } from "@/lib/db";
import { dashboardService } from "@/services/dashboard";
import { getMailTrafficSeries } from "@/lib/mail/daily-stats";

export const analyticsService = {
  async getOverview() {
    const [metrics, traffic, revenueAgg, subsByStatus, domainsByDns] = await Promise.all([
      dashboardService.getMetrics(),
      getMailTrafficSeries(30),
      prisma.order.aggregate({
        _sum: { amountUsd: true },
        where: { status: "PAID" },
      }),
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.domain.groupBy({
        by: ["dnsStatus"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const paidRevenue = Number(revenueAgg._sum.amountUsd ?? 0);
    const spamBlocked24h = traffic.length
      ? (traffic[traffic.length - 1]?.spam ?? 0)
      : metrics.spamBlocked24h;

    const last30Sent = traffic.reduce((s, t) => s + t.mail, 0);
    const last30Spam = traffic.reduce((s, t) => s + t.spam, 0);

    return {
      metrics: {
        ...metrics,
        spamBlocked24h: last30Spam > 0 ? last30Spam : spamBlocked24h,
        paidRevenueUsd: paidRevenue,
        mailSent30d: last30Sent,
        spamActions30d: last30Spam,
      },
      traffic,
      subscriptions: subsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      dnsBreakdown: domainsByDns.map((d) => ({ status: d.dnsStatus, count: d._count._all })),
    };
  },

  async getRevenueSeries(days = 30) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const orders = await prisma.order.findMany({
      where: { status: "PAID", createdAt: { gte: since } },
      select: { createdAt: true, amountUsd: true },
      orderBy: { createdAt: "asc" },
    });
    const buckets = new Map<string, number>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(o.amountUsd));
    }
    return [...buckets.entries()].map(([date, amountUsd]) => ({ date, amountUsd }));
  },
};
