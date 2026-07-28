"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, HeartPulse, Server, XCircle } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatsCard } from "@/components/admin/stats-card";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { GlassPanel } from "@/components/shared/glass-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loading } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/api/admin-fetch";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types";
import type { HealthCheck, MailHealthReport } from "@/services/provisioning/mail-health";

async function fetchMailHealth() {
  const res = await adminFetch("/api/admin/mail-health");
  const json = (await res.json()) as ApiResponse<MailHealthReport>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load mail health");
  return json.data;
}

function CheckDot({ check }: { check: HealthCheck }) {
  const Icon = check.ok ? CheckCircle2 : XCircle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        check.tone === "ok" && "text-emerald-600 dark:text-emerald-400",
        check.tone === "warn" && "text-amber-700 dark:text-amber-300",
        check.tone === "fail" && "text-red-600 dark:text-red-400",
        check.tone === "skip" && "text-muted-foreground",
      )}
      title={check.detail}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="font-medium">{check.label}</span>
    </span>
  );
}

function statusTone(status: string) {
  if (status === "healthy") return "success" as const;
  if (status === "degraded") return "warning" as const;
  return "danger" as const;
}

export function MailHealthPage() {
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-mail-health"],
    queryFn: fetchMailHealth,
    refetchInterval: 60_000,
  });

  return (
    <AdminShell
      title="Mail Health"
      description="Live Domain · Mailbox · SMTP · IMAP · DKIM/SPF/DMARC · Maildir · Quota status"
    >
      <div className="mb-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {isLoading ? <Loading label="Checking mail health…" /> : null}
      {error ? (
        <GlassPanel className="p-5">
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
        </GlassPanel>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatsCard title="Domains" value={data.summary.domains} icon={Server} />
            <StatsCard title="Mailboxes" value={data.summary.mailboxes} icon={HeartPulse} />
            <StatsCard title="Healthy" value={data.summary.healthy} icon={CheckCircle2} />
            <StatsCard title="Degraded" value={data.summary.degraded} icon={HeartPulse} />
            <StatsCard title="Unhealthy" value={data.summary.unhealthy} icon={XCircle} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <GlassPanel className="p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">SMTP</h2>
                <StatusPill
                  label={data.smtpPort.ok ? "healthy" : "down"}
                  tone={statusToneFromValue(data.smtpPort.ok ? "ACTIVE" : "FAILED")}
                />
              </div>
              <p className="text-sm text-muted-foreground">{data.smtpPort.detail}</p>
            </GlassPanel>
            <GlassPanel className="p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">IMAP</h2>
                <StatusPill
                  label={data.imapPort.ok ? "healthy" : "down"}
                  tone={statusToneFromValue(data.imapPort.ok ? "ACTIVE" : "FAILED")}
                />
              </div>
              <p className="text-sm text-muted-foreground">{data.imapPort.detail}</p>
            </GlassPanel>
          </div>

          {data.domains.map((domain) => (
            <GlassPanel key={domain.domainId} className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">{domain.domain}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    mailStatus={domain.mailStatus} · dnsStatus={domain.dnsStatus}
                    {domain.provisionedAt ? ` · provisioned ${domain.provisionedAt}` : " · not provisioned"}
                  </p>
                </div>
                <StatusPill label={domain.status} tone={statusTone(domain.status)} />
              </div>

              <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
                {domain.checks.map((c) => (
                  <CheckDot key={c.key} check={c} />
                ))}
              </div>

              {domain.mailboxes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active mailboxes on this domain.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mailbox</TableHead>
                        <TableHead>Checks</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {domain.mailboxes.map((mb) => (
                        <TableRow key={mb.mailboxId}>
                          <TableCell className="font-mono text-sm">{mb.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-x-3 gap-y-1.5 py-1">
                              {mb.checks.map((c) => (
                                <CheckDot key={c.key} check={c} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusPill label={mb.status} tone={statusTone(mb.status)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassPanel>
          ))}

          {data.domains.length === 0 ? (
            <GlassPanel className="p-5">
              <p className="text-sm text-muted-foreground">No active domains to check.</p>
            </GlassPanel>
          ) : null}

          <p className="text-center text-[11px] text-muted-foreground">
            Last checked {new Date(data.checkedAt).toLocaleString()}
            {data.mysqlConfigured ? "" : " · MySQL mail auth not configured on this host"}
          </p>
        </div>
      ) : null}
    </AdminShell>
  );
}
