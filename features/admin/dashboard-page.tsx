"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AtSign,
  Bell,
  Forward,
  Globe2,
  HardDrive,
  Inbox,
  ScrollText,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatsCard } from "@/components/admin/stats-card";
import { MailTrafficChart } from "@/components/admin/mail-traffic-chart";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { Loading } from "@/components/ui/loading";
import type {
  ApiResponse,
  AuditLogEntry,
  DashboardMetrics,
  MonitoringSnapshot,
} from "@/types";

import { adminFetch } from "@/lib/api/admin-fetch";

async function fetchDashboard() {
  const res = await adminFetch("/api/admin/dashboard");
  const json = (await res.json()) as ApiResponse<{
    metrics: DashboardMetrics;
    monitoring: MonitoringSnapshot;
    recentActivity: AuditLogEntry[];
    notifications: {
      id: string;
      title: string;
      body: string;
      read: boolean;
      createdAt: string;
    }[];
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

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Aliases"
              value={data.metrics.aliases}
              hint="Active mailbox aliases"
              icon={AtSign}
            />
            <StatsCard
              title="Forwarders"
              value={data.metrics.forwarders}
              hint="Active forward rules"
              icon={Forward}
            />
            <StatsCard
              title="Audit Logs"
              value={data.metrics.auditLogs}
              hint="Security trail events"
              icon={ScrollText}
            />
            <StatsCard
              title="Notifications"
              value={data.metrics.unreadNotifications}
              hint={`${data.metrics.notifications} total`}
              icon={Bell}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="glass-surface rounded-2xl p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">Platform Snapshot</h2>
                  <p className="text-xs text-muted-foreground">
                    Live PostgreSQL counts · VPS mail telemetry in Phase 3B
                  </p>
                </div>
                <Activity className="size-4 text-gold" />
              </div>
              <MailTrafficChart
                data={[
                  { label: "Domains", mail: data.metrics.domains, spam: 0 },
                  { label: "Mailboxes", mail: data.metrics.mailboxes, spam: 0 },
                  { label: "Aliases", mail: data.metrics.aliases, spam: 0 },
                  { label: "Users", mail: data.metrics.users, spam: 0 },
                ]}
              />
            </div>

            <div className="glass-surface space-y-4 rounded-2xl p-5">
              <h2 className="font-display text-xl font-semibold">System Status</h2>
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

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass-surface rounded-2xl p-5">
              <h2 className="mb-4 font-display text-xl font-semibold">Recent Activity</h2>
              <ul className="space-y-3">
                {data.recentActivity.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No activity yet.</li>
                ) : (
                  data.recentActivity.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.actorEmail ?? "system"} · {item.resource}
                        </p>
                      </div>
                      <time className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </time>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="glass-surface rounded-2xl p-5">
              <h2 className="mb-4 font-display text-xl font-semibold">Notifications</h2>
              <ul className="space-y-3">
                {data.notifications.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No notifications.</li>
                ) : (
                  data.notifications.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-xl border border-border/50 bg-background/30 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{n.title}</p>
                        {!n.read ? (
                          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] text-gold">
                            New
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
