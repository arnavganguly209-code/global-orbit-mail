"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Globe2,
  Inbox,
  Mail,
  ShieldAlert,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MailTrafficChart } from "@/components/admin/mail-traffic-chart";
import { StatsCard } from "@/components/admin/stats-card";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Loading } from "@/components/ui/loading";
import { adminFetch } from "@/lib/api/admin-fetch";
import { formatUsd } from "@/features/admin/admin-format";
import type { ApiResponse, DashboardMetrics } from "@/types";

type AnalyticsOverview = {
  metrics: DashboardMetrics & {
    paidRevenueUsd: number;
    mailSent30d: number;
    spamActions30d: number;
  };
  traffic: { label: string; mail: number; spam: number }[];
  subscriptions: { status: string; count: number }[];
  dnsBreakdown: { status: string; count: number }[];
};

async function fetchAnalytics() {
  const res = await adminFetch("/api/admin/analytics");
  const json = (await res.json()) as ApiResponse<AnalyticsOverview>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load analytics");
  return json.data;
}

export function AnalyticsAdminPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: fetchAnalytics,
    refetchInterval: 60_000,
  });

  return (
    <AdminShell
      title="Analytics"
      description="Platform metrics, mail traffic, and subscription breakdown"
    >
      {isLoading ? <Loading label="Loading analytics…" /> : null}
      {error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Error"}</p>
      ) : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatsCard title="Domains" value={data.metrics.domains} hint={`${data.metrics.activeDomains} active`} icon={Globe2} />
            <StatsCard title="Mailboxes" value={data.metrics.mailboxes} icon={Inbox} />
            <StatsCard title="Users" value={data.metrics.users} icon={Users} />
            <StatsCard title="Mail (30d)" value={data.metrics.mailSent30d} icon={Mail} />
            <StatsCard title="Spam (30d)" value={data.metrics.spamActions30d} icon={ShieldAlert} />
            <StatsCard title="Revenue" value={formatUsd(data.metrics.paidRevenueUsd)} icon={DollarSign} />
          </div>

          <GlassPanel className="p-5">
            <h2 className="mb-4 font-display text-xl font-semibold">Mail traffic (30 days)</h2>
            <MailTrafficChart data={data.traffic} />
          </GlassPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="p-5">
              <h2 className="mb-4 font-display text-xl font-semibold">Subscriptions</h2>
              {data.subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscription data.</p>
              ) : (
                <ul className="space-y-2">
                  {data.subscriptions.map((s) => (
                    <li
                      key={s.status}
                      className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
                    >
                      <StatusPill label={s.status} tone={statusToneFromValue(s.status)} uppercase />
                      <span className="font-medium">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassPanel>

            <GlassPanel className="p-5">
              <h2 className="mb-4 font-display text-xl font-semibold">DNS status</h2>
              {data.dnsBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No domain DNS data.</p>
              ) : (
                <ul className="space-y-2">
                  {data.dnsBreakdown.map((d) => (
                    <li
                      key={d.status}
                      className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
                    >
                      <StatusPill label={d.status} tone={statusToneFromValue(d.status)} uppercase />
                      <span className="font-medium">{d.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassPanel>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
