"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Globe2,
  HardDrive,
  Inbox,
  MailWarning,
  Server,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatsCard } from "@/components/admin/stats-card";
import { MailTrafficChart } from "@/components/admin/mail-traffic-chart";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { Loading } from "@/components/ui/loading";
import type { ApiResponse, DashboardMetrics, MonitoringSnapshot } from "@/types";

async function fetchDashboard() {
  const res = await fetch("/api/admin/dashboard");
  const json = (await res.json()) as ApiResponse<{
    metrics: DashboardMetrics;
    monitoring: MonitoringSnapshot;
  }>;
  if (!json.success) throw new Error(json.message ?? "Failed");
  return json.data;
}

export function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 30_000,
  });

  return (
    <AdminShell
      title="Dashboard"
      description="Enterprise command center for GLOBAL ORBIT MAIL"
    >
      {isLoading ? <Loading label="Loading dashboard" fullScreen /> : null}
      {error ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Active Domains"
              value={data.metrics.activeDomains}
              hint={`${data.metrics.domains} total domains`}
              icon={Globe2}
            />
            <StatsCard
              title="Mailboxes"
              value={data.metrics.mailboxes}
              hint="Provisioned identities"
              icon={Inbox}
            />
            <StatsCard
              title="Users"
              value={data.metrics.users}
              hint="Platform identities"
              icon={Users}
            />
            <StatsCard
              title="Storage"
              value={`${data.metrics.storageUsedGb} GB`}
              hint={`of ${data.metrics.storageQuotaGb} GB allocated`}
              icon={HardDrive}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="glass-surface rounded-2xl p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">Mail Traffic</h2>
                  <p className="text-xs text-muted-foreground">
                    Architecture telemetry series · live VPS feed pending
                  </p>
                </div>
                <Activity className="size-4 text-gold" />
              </div>
              <MailTrafficChart
                data={
                  data.monitoring.series.length > 0
                    ? data.monitoring.series
                    : [
                        { label: "DB", mail: data.metrics.mailboxes, spam: 0 },
                        { label: "Domains", mail: data.metrics.domains, spam: 0 },
                        { label: "Users", mail: data.metrics.users, spam: 0 },
                      ]
                }
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Chart reflects live database counts until VPS mail telemetry is connected.
              </p>
            </div>

            <div className="glass-surface space-y-4 rounded-2xl p-5">
              <h2 className="font-display text-xl font-semibold">System Health</h2>
              <div className="space-y-3">
                {data.monitoring.components.map((component) => (
                  <div
                    key={component.id}
                    className="rounded-xl border border-border/60 bg-background/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{component.name}</p>
                      <StatusPill
                        label={component.status.replaceAll("_", " ")}
                        tone={statusToneFromValue(component.status)}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{component.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatsCard
              title="Spam Blocked (series)"
              value={data.metrics.spamBlocked24h}
              hint="From architecture traffic series"
              icon={MailWarning}
            />
            <StatsCard
              title="Mail Queue Depth"
              value={data.metrics.mailQueueDepth}
              hint="Latest series point · Postfix pending"
              icon={Server}
            />
            <StatsCard
              title="API Surface"
              value="Online"
              hint="Admin REST routes operational"
              icon={Activity}
            />
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
