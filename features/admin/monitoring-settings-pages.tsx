"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
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
import { adminFetch } from "@/lib/api/admin-fetch";
import type { ApiResponse, MonitoringSnapshot } from "@/types";
import * as React from "react";

export function MonitoringAdminPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-monitoring"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/monitoring");
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
  const { setTheme } = useTheme();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/settings");
      const json = (await res.json()) as ApiResponse<Record<string, Record<string, unknown>>>;
      if (!json.success) throw new Error("Failed");
      return json.data;
    },
  });

  const [company, setCompany] = React.useState({
    name: "",
    supportEmail: "",
    website: "",
    timezone: "Asia/Kathmandu",
    language: "en",
  });
  const [brand, setBrand] = React.useState({
    product: "",
    primaryColor: "#2f6fed",
    accentColor: "#d4af37",
    logoPath: "/brand/logo.png",
  });
  const [smtp, setSmtp] = React.useState({
    host: "",
    port: "587",
    encryption: "STARTTLS",
  });
  const [imap, setImap] = React.useState({
    host: "",
    port: "993",
    encryption: "SSL/TLS",
  });
  const [security, setSecurity] = React.useState({
    passwordMinLength: "12",
    require2faForAdmins: true,
    sessionTimeoutMinutes: "720",
  });
  const [appearance, setAppearance] = React.useState({
    darkMode: "system",
  });

  React.useEffect(() => {
    if (!data) return;
    const c = data.company ?? {};
    const b = data.brand ?? {};
    const s = data.security ?? {};
    const sm = data.smtp ?? {};
    const im = data.imap ?? {};
    const ap = data.appearance ?? {};
    setCompany({
      name: String(c.name ?? ""),
      supportEmail: String(c.supportEmail ?? ""),
      website: String(c.website ?? ""),
      timezone: String(c.timezone ?? "Asia/Kathmandu"),
      language: String(c.language ?? "en"),
    });
    setBrand({
      product: String(b.product ?? ""),
      primaryColor: String(b.primaryColor ?? "#2f6fed"),
      accentColor: String(b.accentColor ?? "#d4af37"),
      logoPath: String(b.logoPath ?? "/brand/logo.png"),
    });
    setSmtp({
      host: String(sm.host ?? ""),
      port: String(sm.port ?? 587),
      encryption: String(sm.encryption ?? "STARTTLS"),
    });
    setImap({
      host: String(im.host ?? ""),
      port: String(im.port ?? 993),
      encryption: String(im.encryption ?? "SSL/TLS"),
    });
    setSecurity({
      passwordMinLength: String(s.passwordMinLength ?? 12),
      require2faForAdmins: Boolean(s.require2faForAdmins),
      sessionTimeoutMinutes: String(s.sessionTimeoutMinutes ?? 720),
    });
    setAppearance({
      darkMode: String(ap.darkMode ?? "system"),
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { section: string; values: Record<string, unknown> }) => {
      const res = await adminFetch("/api/admin/settings", {
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

  function onLogoSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image file");
      return;
    }
    if (file.size > 512_000) {
      toast.error("Logo must be under 512KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setBrand((b) => ({ ...b, logoPath: result }));
      toast.message("Logo loaded", { description: "Save brand to persist" });
    };
    reader.readAsDataURL(file);
  }

  return (
    <AdminShell
      title="Settings"
      description="Company · Brand · SMTP · IMAP · Security · Appearance"
    >
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={company.timezone}
                  onChange={(e) => setCompany((c) => ({ ...c, timezone: e.target.value }))}
                  placeholder="Asia/Kathmandu"
                />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Input
                  value={company.language}
                  onChange={(e) => setCompany((c) => ({ ...c, language: e.target.value }))}
                  placeholder="en"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => saveMutation.mutate({ section: "company", values: company })}
            >
              Save company
            </Button>
          </section>

          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">Brand & Logo</h2>
            <div className="space-y-2">
              <Label>Product name</Label>
              <Input
                value={brand.product}
                onChange={(e) => setBrand((b) => ({ ...b, product: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Primary color</Label>
                <Input
                  value={brand.primaryColor}
                  onChange={(e) => setBrand((b) => ({ ...b, primaryColor: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Accent color</Label>
                <Input
                  value={brand.accentColor}
                  onChange={(e) => setBrand((b) => ({ ...b, accentColor: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Logo path / URL</Label>
              <Input
                value={brand.logoPath.startsWith("data:") ? "(uploaded data URL)" : brand.logoPath}
                onChange={(e) => setBrand((b) => ({ ...b, logoPath: e.target.value }))}
                disabled={brand.logoPath.startsWith("data:")}
              />
            </div>
            <div className="space-y-2">
              <Label>Upload logo</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => onLogoSelected(e.target.files?.[0] ?? null)}
              />
            </div>
            {brand.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoPath}
                alt="Brand logo preview"
                className="h-12 w-auto object-contain"
              />
            ) : null}
            <Button
              type="button"
              onClick={() => saveMutation.mutate({ section: "brand", values: brand })}
            >
              Save brand
            </Button>
          </section>

          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">SMTP</h2>
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                value={smtp.host}
                onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  value={smtp.port}
                  onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Encryption</Label>
                <Input
                  value={smtp.encryption}
                  onChange={(e) => setSmtp((s) => ({ ...s, encryption: e.target.value }))}
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={() =>
                saveMutation.mutate({
                  section: "smtp",
                  values: { ...smtp, port: Number(smtp.port) },
                })
              }
            >
              Save SMTP
            </Button>
          </section>

          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">IMAP</h2>
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                value={imap.host}
                onChange={(e) => setImap((s) => ({ ...s, host: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  value={imap.port}
                  onChange={(e) => setImap((s) => ({ ...s, port: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Encryption</Label>
                <Input
                  value={imap.encryption}
                  onChange={(e) => setImap((s) => ({ ...s, encryption: e.target.value }))}
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={() =>
                saveMutation.mutate({
                  section: "imap",
                  values: { ...imap, port: Number(imap.port) },
                })
              }
            >
              Save IMAP
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

          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">Appearance</h2>
            <div className="space-y-2">
              <Label>Dark mode preference</Label>
              <div className="flex flex-wrap gap-2">
                {(["light", "dark", "system"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={appearance.darkMode === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAppearance({ darkMode: mode })}
                  >
                    {mode}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                setTheme(appearance.darkMode);
                saveMutation.mutate({ section: "appearance", values: appearance });
              }}
            >
              Save appearance
            </Button>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
