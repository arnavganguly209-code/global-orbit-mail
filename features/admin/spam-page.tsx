"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MailTrafficChart } from "@/components/admin/mail-traffic-chart";
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
import { adminFetch } from "@/lib/api/admin-fetch";
import { formatDateTime } from "@/features/admin/admin-format";
import type { ApiResponse, SystemHealthComponent } from "@/types";

type SpamOverview = {
  rspamd: SystemHealthComponent & { detail?: string | null };
  stats: {
    spamActions14d: number;
    sent14d: number;
    spamRate: number;
  };
  traffic: { label: string; mail: number; spam: number }[];
  recentActions: {
    id: string;
    actorEmail: string | null;
    action: string;
    metadata: unknown;
    createdAt: string;
  }[];
};

async function fetchSpam() {
  const res = await adminFetch("/api/admin/spam");
  const json = (await res.json()) as ApiResponse<SpamOverview>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load spam overview");
  return json.data;
}

export function SpamAdminPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-spam"],
    queryFn: fetchSpam,
    refetchInterval: 30_000,
  });

  return (
    <AdminShell title="Spam Tools" description="Rspamd status, spam traffic, and recent actions">
      {isLoading ? <Loading label="Loading spam overview…" /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Rspamd"
              value={data.rspamd.status}
              hint={data.rspamd.detail ?? undefined}
              icon={ShieldCheck}
            />
            <StatsCard title="Spam actions (14d)" value={data.stats.spamActions14d} icon={ShieldAlert} />
            <StatsCard title="Mail sent (14d)" value={data.stats.sent14d} icon={Mail} />
            <StatsCard title="Spam rate" value={`${data.stats.spamRate}%`} icon={ShieldAlert} />
          </div>

          <GlassPanel className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Rspamd service</h2>
              <StatusPill
                label={data.rspamd.status}
                tone={statusToneFromValue(data.rspamd.status)}
                uppercase
              />
            </div>
            {data.rspamd.detail ? (
              <p className="text-sm text-muted-foreground">{data.rspamd.detail}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No additional detail available.</p>
            )}
          </GlassPanel>

          <GlassPanel className="p-5">
            <h2 className="mb-4 font-display text-xl font-semibold">Spam traffic (14 days)</h2>
            <MailTrafficChart data={data.traffic} />
          </GlassPanel>

          <GlassPanel className="p-5">
            <h2 className="mb-4 font-display text-xl font-semibold">Recent spam actions</h2>
            {data.recentActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent spam actions recorded.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentActions.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.action}</TableCell>
                        <TableCell className="text-muted-foreground">{a.actorEmail ?? "—"}</TableCell>
                        <TableCell>{formatDateTime(a.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </GlassPanel>
        </div>
      ) : null}
    </AdminShell>
  );
}
