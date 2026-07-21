"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatsCard } from "@/components/admin/stats-card";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { MailTrafficChart } from "@/components/admin/mail-traffic-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { Cpu, Database, HardDrive, ListOrdered } from "lucide-react";
import type { ApiResponse, MonitoringSnapshot } from "@/types";
import * as React from "react";

export function MonitoringAdminPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-monitoring"],
    queryFn: async () => {
      const res = await fetch("/api/admin/monitoring");
      const json = (await res.json()) as ApiResponse<MonitoringSnapshot>;
      if (!json.success) throw new Error("Failed");
      return json.data;
    },
    refetchInterval: 15_000,
  });

  return (
    <AdminShell
      title="Monitoring"
      description="CPU · RAM · Disk · Mail Queue · Rspamd · Postfix · Dovecot"
    >
      {isLoading ? <Loading /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="CPU"
              value={data.cpuPercent == null ? "—" : `${data.cpuPercent}%`}
              hint="Awaiting VPS telemetry"
              icon={Cpu}
            />
            <StatsCard
              title="RAM"
              value={data.ramPercent == null ? "—" : `${data.ramPercent}%`}
              hint="Awaiting VPS telemetry"
              icon={Database}
            />
            <StatsCard
              title="Disk"
              value={data.diskPercent == null ? "—" : `${data.diskPercent}%`}
              hint="Awaiting VPS telemetry"
              icon={HardDrive}
            />
            <StatsCard
              title="Mail Queue"
              value={data.mailQueue == null ? "—" : data.mailQueue}
              hint="Postfix queue integration pending"
              icon={ListOrdered}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass-surface rounded-2xl p-5">
              <h2 className="mb-4 font-display text-xl font-semibold">Traffic Series</h2>
              <MailTrafficChart data={data.series} />
            </div>
            <div className="glass-surface space-y-3 rounded-2xl p-5">
              <h2 className="font-display text-xl font-semibold">Service Matrix</h2>
              {data.components.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/60 p-3"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                  <StatusPill
                    label={c.status.replaceAll("_", " ")}
                    tone={statusToneFromValue(c.status)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

export function SettingsAdminPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      const json = (await res.json()) as ApiResponse<Record<string, Record<string, unknown>>>;
      if (!json.success) throw new Error("Failed");
      return json.data;
    },
  });

  const [company, setCompany] = React.useState({ name: "", supportEmail: "", website: "" });
  const [security, setSecurity] = React.useState({
    passwordMinLength: "12",
    require2faForAdmins: true,
    sessionTimeoutMinutes: "720",
  });

  React.useEffect(() => {
    if (!data) return;
    const c = data.company ?? {};
    const s = data.security ?? {};
    setCompany({
      name: String(c.name ?? ""),
      supportEmail: String(c.supportEmail ?? ""),
      website: String(c.website ?? ""),
    });
    setSecurity({
      passwordMinLength: String(s.passwordMinLength ?? 12),
      require2faForAdmins: Boolean(s.require2faForAdmins),
      sessionTimeoutMinutes: String(s.sessionTimeoutMinutes ?? 720),
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { section: string; values: Record<string, unknown> }) => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Save failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Settings" description="Company · Brand · SMTP · IMAP · Security · 2FA ready">
      {isLoading ? <Loading /> : null}
      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">Company</h2>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={company.name}
                onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Support email</Label>
              <Input
                value={company.supportEmail}
                onChange={(e) => setCompany((c) => ({ ...c, supportEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={company.website}
                onChange={(e) => setCompany((c) => ({ ...c, website: e.target.value }))}
              />
            </div>
            <Button
              type="button"
              onClick={() => saveMutation.mutate({ section: "company", values: company })}
            >
              Save company
            </Button>
          </section>

          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">Security / Password Policy</h2>
            <div className="space-y-2">
              <Label>Minimum password length</Label>
              <Input
                value={security.passwordMinLength}
                onChange={(e) =>
                  setSecurity((s) => ({ ...s, passwordMinLength: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Session timeout (minutes)</Label>
              <Input
                value={security.sessionTimeoutMinutes}
                onChange={(e) =>
                  setSecurity((s) => ({ ...s, sessionTimeoutMinutes: e.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={security.require2faForAdmins}
                onChange={(e) =>
                  setSecurity((s) => ({ ...s, require2faForAdmins: e.target.checked }))
                }
              />
              Require 2FA for admins (ready)
            </label>
            <Button
              type="button"
              onClick={() =>
                saveMutation.mutate({
                  section: "security",
                  values: {
                    passwordMinLength: Number(security.passwordMinLength),
                    sessionTimeoutMinutes: Number(security.sessionTimeoutMinutes),
                    require2faForAdmins: security.require2faForAdmins,
                  },
                })
              }
            >
              Save security
            </Button>
          </section>

          <section className="glass-surface space-y-3 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">SMTP</h2>
            <pre className="overflow-auto rounded-xl bg-black/30 p-4 text-xs text-muted-foreground">
              {JSON.stringify(data.smtp, null, 2)}
            </pre>
          </section>
          <section className="glass-surface space-y-3 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">IMAP</h2>
            <pre className="overflow-auto rounded-xl bg-black/30 p-4 text-xs text-muted-foreground">
              {JSON.stringify(data.imap, null, 2)}
            </pre>
          </section>
          <section className="glass-surface space-y-3 rounded-2xl p-6 lg:col-span-2">
            <h2 className="font-display text-xl font-semibold">Brand</h2>
            <pre className="overflow-auto rounded-xl bg-black/30 p-4 text-xs text-muted-foreground">
              {JSON.stringify(data.brand, null, 2)}
            </pre>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
