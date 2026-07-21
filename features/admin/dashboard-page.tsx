"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AtSign,
  Bell,
  Cpu,
  Database,
  Forward,
  Globe2,
  HardDrive,
  Inbox,
  Network,
  ScrollText,
  Server,
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
  VerificationTone,
} from "@/types";

import { adminFetch } from "@/lib/api/admin-fetch";

const quickActions = [
  {
    href: "/orbit/domains",
    title: "Domains",
    description: "Add, verify, and manage domains",
    icon: Globe2,
  },
  {
    href: "/orbit/mailboxes",
    title: "Mailboxes",
    description: "Provision identities and quotas",
    icon: Inbox,
  },
  {
    href: "/orbit/dns",
    title: "DNS",
    description: "MX · SPF · DKIM · DMARC records",
    icon: Network,
  },
  {
    href: "/orbit/monitoring",
    title: "Monitoring",
    description: "Server health and mail queue",
    icon: Server,
  },
] as const;

function componentTone(status: string): VerificationTone {
  const v = status.toLowerCase();
  if (v === "awaiting_integration" || v.includes("awaiting")) return "warning";
  return statusToneFromValue(status);
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

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

  const series = data?.monitoring.series ?? [];
  const hasSeries = series.length > 0;
  const showResourceCards =
    data != null &&
    (data.monitoring.cpuPercent != null ||
      data.monitoring.ramPercent != null ||
      data.monitoring.diskPercent != null ||
      data.monitoring.mailQueue != null);

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
        <div className="space-y-8">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group glass-surface rounded-2xl p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-primary/15 p-2.5 text-primary transition-colors group-hover:bg-gold/15 group-hover:text-gold">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="font-medium tracking-tight">{action.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          </section>

          {showResourceCards ? (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatsCard
                title="CPU"
                value={
                  data.monitoring.cpuPercent == null
                    ? "—"
                    : `${data.monitoring.cpuPercent}%`
                }
                hint="Host utilization"
                icon={Cpu}
              />
              <StatsCard
                title="RAM"
                value={
                  data.monitoring.ramPercent == null
                    ? "—"
                    : `${data.monitoring.ramPercent}%`
                }
                hint="Memory pressure"
                icon={Database}
              />
              <StatsCard
                title="Disk"
                value={
                  data.monitoring.diskPercent == null
                    ? "—"
                    : `${data.monitoring.diskPercent}%`
                }
                hint="Storage capacity"
                icon={HardDrive}
              />
              <StatsCard
                title="Mail Queue"
                value={
                  data.monitoring.mailQueue == null ? "—" : data.monitoring.mailQueue
                }
                hint="Deferred / active queue"
                icon={Activity}
              />
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-3">
            {hasSeries ? (
              <div className="glass-surface rounded-2xl p-5 lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Mail Traffic</h2>
                    <p className="text-xs text-muted-foreground">
                      Live series from monitoring telemetry
                    </p>
                  </div>
                  <Activity className="size-4 text-gold" />
                </div>
                <MailTrafficChart data={series} />
              </div>
            ) : (
              <div className="glass-surface flex flex-col justify-center rounded-2xl p-5 lg:col-span-2">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Platform Snapshot</h2>
                    <p className="text-xs text-muted-foreground">
                      Traffic charts appear when VPS telemetry is connected
                    </p>
                  </div>
                  <Activity className="size-4 text-gold" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Domains
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold">
                      {data.metrics.domains}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Mailboxes
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold">
                      {data.metrics.mailboxes}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Aliases
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold">
                      {data.metrics.aliases}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Users
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold">
                      {data.metrics.users}
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                        tone={componentTone(component.status)}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{component.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
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
                      <time
                        className="shrink-0 text-[10px] text-muted-foreground"
                        title={new Date(item.createdAt).toLocaleString()}
                      >
                        {formatRelative(item.createdAt)}
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
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
