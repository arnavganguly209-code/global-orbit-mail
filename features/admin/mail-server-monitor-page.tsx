"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  ListOrdered,
  RefreshCw,
  Server,
  Wrench,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatsCard } from "@/components/admin/stats-card";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { adminFetch } from "@/lib/api/admin-fetch";
import type { ApiResponse } from "@/types";
import type { MailServerMonitorSnapshot } from "@/services/monitoring/mail-server-monitor";

async function fetchMonitor() {
  const res = await adminFetch("/api/admin/mail-monitor");
  const json = (await res.json()) as ApiResponse<MailServerMonitorSnapshot>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load mail monitor");
  return json.data;
}

function svcTone(status: string) {
  if (status === "active" || status === "operational") return "success" as const;
  if (status === "degraded" || status === "activating") return "warning" as const;
  if (status === "down" || status === "failed" || status === "inactive") return "danger" as const;
  return "neutral" as const;
}

const SERVICE_LABELS: Record<string, string> = {
  postfix: "Postfix",
  dovecot: "Dovecot",
  opendkim: "OpenDKIM",
  rspamd: "Rspamd",
  nginx: "Nginx",
  php: "PHP-FPM",
  webmail: "Orbit Webmail",
  database: "Database",
  redis: "Redis",
  roundcube: "Orbit Webmail",
};

/** Prefer mail-critical services; hide legacy false names. */
const SERVICE_ORDER = [
  "postfix",
  "dovecot",
  "opendkim",
  "rspamd",
  "nginx",
  "php",
  "webmail",
  "database",
  "redis",
];

function orderedServices(services: Record<string, string>) {
  const cleaned: Record<string, string> = { ...services };
  // Map old roundcube key into webmail if present
  if (cleaned.roundcube && !cleaned.webmail) {
    cleaned.webmail = cleaned.roundcube;
  }
  delete cleaned.roundcube;
  const keys = [
    ...SERVICE_ORDER.filter((k) => k in cleaned),
    ...Object.keys(cleaned).filter((k) => !SERVICE_ORDER.includes(k)),
  ];
  return keys.map((id) => ({ id, status: cleaned[id], label: SERVICE_LABELS[id] ?? id }));
}

export function MailServerMonitorPage() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-mail-monitor"],
    queryFn: fetchMonitor,
    refetchInterval: 15_000,
  });

  const action = useMutation({
    mutationFn: async (body: { action: string; email?: string }) => {
      const res = await adminFetch("/api/admin/mail-monitor", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Action failed");
      return json;
    },
    onSuccess: (json) => {
      toast.success(json.message ?? "Done");
      void qc.invalidateQueries({ queryKey: ["admin-mail-monitor"] });
      void qc.invalidateQueries({ queryKey: ["admin-mail-health"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  return (
    <AdminShell
      title="Mail Server Monitor"
      description="Queue · failed sends · slow delivery · system load · service health · mailbox repair"
    >
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
          <RefreshCw className={`mr-2 size-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={action.isPending}
          onClick={() => action.mutate({ action: "flush-queue" })}
        >
          Flush queue
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={action.isPending}
          onClick={() => action.mutate({ action: "resync-auth" })}
        >
          <Wrench className="mr-2 size-4" />
          Resync all auth
        </Button>
      </div>

      {isLoading ? <Loading label="Loading mail server monitor…" /> : null}
      {error ? (
        <GlassPanel className="border-red-500/30 p-4 text-sm text-red-600">{String(error)}</GlassPanel>
      ) : null}

      {data ? (
        <div className="space-y-6">
          {!data.agentOk ? (
            <GlassPanel className="border-amber-500/40 p-4 text-sm text-amber-800 dark:text-amber-200">
              Agent monitor partial: {data.agentError ?? "VPS agent unavailable"} — showing Orbit-side checks only.
            </GlassPanel>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Mail Queue"
              value={data.queueCount}
              hint={data.queueCount ? "Messages waiting in Postfix" : "Queue empty"}
              icon={ListOrdered}
            />
            <StatsCard
              title="CPU Load"
              value={data.cpuPercent == null ? "—" : `${data.cpuPercent}%`}
              hint={data.loadAvg.length ? `load ${data.loadAvg.join(" ")}` : "VPS load average"}
              icon={Cpu}
            />
            <StatsCard
              title="RAM"
              value={data.ramPercent == null ? "—" : `${data.ramPercent}%`}
              hint="Memory usage"
              icon={Database}
            />
            <StatsCard
              title="Disk"
              value={data.diskPercent == null ? "—" : `${data.diskPercent}%`}
              hint="Root filesystem"
              icon={HardDrive}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Server className="size-5 text-primary" />
                <h2 className="font-display text-xl font-semibold">Services</h2>
              </div>
              {orderedServices(data.services).map(({ id, status, label }) => (
                <div key={id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                  <span className="font-medium">{label}</span>
                  <StatusPill label={status} tone={svcTone(status)} />
                </div>
              ))}
            </GlassPanel>

            <GlassPanel className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Activity className="size-5 text-primary" />
                <h2 className="font-display text-xl font-semibold">Mail Health Summary</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>Domains: {data.mailHealthSummary.domains}</div>
                <div>Mailboxes: {data.mailHealthSummary.mailboxes}</div>
                <div className="text-emerald-600">Healthy: {data.mailHealthSummary.healthy}</div>
                <div className="text-amber-600">Degraded: {data.mailHealthSummary.degraded}</div>
                <div className="text-red-600">Unhealthy: {data.mailHealthSummary.unhealthy}</div>
              </div>
            </GlassPanel>
          </div>

          {data.queueSample.length ? (
            <GlassPanel className="p-5">
              <h2 className="mb-3 font-display text-xl font-semibold">Queued Messages</h2>
              <pre className="max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">{data.queueSample.join("\n")}</pre>
            </GlassPanel>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="size-5 text-red-500" />
                <h2 className="font-display text-xl font-semibold">Real Delivery Problems</h2>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Only bounces, deferred mail, milter rejects, key errors, and real mailbox auth failures.
                Config noise and scanner bots are filtered out.
              </p>
              {data.recentFailures.length ? (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/40 p-3 text-xs leading-relaxed">
                  {data.recentFailures.join("\n")}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No real delivery failures detected recently.</p>
              )}
            </GlassPanel>

            <GlassPanel className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="size-5 text-amber-500" />
                <h2 className="font-display text-xl font-semibold">Slow Deliveries (&gt;30s)</h2>
              </div>
              {data.slowDeliveries.length ? (
                <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 text-xs leading-relaxed">
                  {data.slowDeliveries.join("\n")}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No slow outbound deliveries detected recently.</p>
              )}
            </GlassPanel>
          </div>

          {data.unhealthyMailboxes.length ? (
            <GlassPanel className="p-5">
              <h2 className="mb-3 font-display text-xl font-semibold">Mailboxes Needing Attention</h2>
              <div className="space-y-3">
                {data.unhealthyMailboxes.map((mb) => (
                  <div key={mb.email} className="rounded-xl border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{mb.email}</p>
                        <p className="text-xs text-muted-foreground">{mb.domain}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill label={mb.status} tone={statusToneFromValue(mb.status)} />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={action.isPending}
                          onClick={() => action.mutate({ action: "repair-mailbox", email: mb.email })}
                        >
                          Repair auth
                        </Button>
                      </div>
                    </div>
                    <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                      {mb.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </GlassPanel>
          ) : null}

          <GlassPanel className="p-5">
            <h2 className="mb-3 font-display text-xl font-semibold">Recent mail.log</h2>
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 text-xs leading-relaxed">
              {data.recentLogTail.join("\n") || "No log tail available"}
            </pre>
          </GlassPanel>
        </div>
      ) : null}
    </AdminShell>
  );
}
