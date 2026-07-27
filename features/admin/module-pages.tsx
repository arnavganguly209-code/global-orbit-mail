"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Cpu, Database, ExternalLink, HardDrive, HeartPulse, Layers, RefreshCw, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatsCard } from "@/components/admin/stats-card";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { Search as SearchInput } from "@/components/ui/search";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminNav } from "@/config/admin-nav";
import { appConfig } from "@/config/app";
import { adminFetch } from "@/lib/api/admin-fetch";
import type { ApiResponse, AuditLogEntry, PaginatedResult } from "@/types";

type SystemHealthReport = {
  checkedAt: string;
  provisionMode: string;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  components: Array<{
    id: string;
    name: string;
    status: string;
    detail: string;
    latencyMs?: number;
  }>;
};

type AdminCustomer = {
  id: string;
  email: string;
  name: string | null;
  organizationName: string | null;
  organizationStatus: string | null;
  planName: string | null;
  status: string;
};

const API_ENDPOINTS = [
  { group: "Auth", routes: ["GET /api/admin/auth/me", "POST /api/admin/auth/logout"] },
  {
    group: "Core",
    routes: [
      "GET /api/admin/domains",
      "GET /api/admin/mailboxes",
      "GET /api/admin/users",
      "GET /api/admin/dns",
    ],
  },
  {
    group: "Operations",
    routes: [
      "GET /api/admin/monitoring",
      "GET /api/admin/system",
      "GET /api/admin/storage",
      "GET /api/admin/audit",
    ],
  },
  {
    group: "Billing",
    routes: [
      "GET /api/admin/plans",
      "GET /api/admin/subscriptions",
      "GET /api/admin/invoices",
      "GET /api/admin/payments",
    ],
  },
  {
    group: "Backups",
    routes: [
      "GET /api/admin/backups",
      "POST /api/admin/backups",
      "POST /api/admin/backups/:id/restore",
    ],
  },
  { group: "Public", routes: ["GET /api/health"] },
] as const;

const RUNBOOK = [
  {
    title: "Domain onboarding",
    href: "/orbit/domains",
    steps: [
      "Create or verify the customer organization under Customers.",
      "Add the domain and complete DNS records in DNS Manager.",
      "Verify SPF, DKIM, and MX before setting mail status to active.",
    ],
  },
  {
    title: "Mailbox provisioning",
    href: "/orbit/mailboxes",
    steps: [
      "Confirm the domain is verified and mailbox slots are available.",
      "Create the mailbox with a 12+ character password.",
      "Use Verify Auth if IMAP/SMTP login fails after provisioning.",
    ],
  },
  {
    title: "Incident response",
    href: "/orbit/monitoring",
    steps: [
      "Check Monitoring and System health for mail stack components.",
      "Review Logs for recent provisioning or auth failures.",
      "Run a domain or mailbox backup before destructive changes.",
    ],
  },
  {
    title: "Billing & entitlements",
    href: "/orbit/billing",
    steps: [
      "Confirm plan and subscription under Billing.",
      "Adjust coupons or invoices as needed.",
      "Suspend organization from Customers if payment lapses.",
    ],
  },
] as const;

export function SecurityAdminPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/settings");
      const json = (await res.json()) as ApiResponse<Record<string, Record<string, unknown>>>;
      if (!json.success) throw new Error("Failed to load settings");
      return json.data;
    },
  });

  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ["admin-audit-security"],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: "1", pageSize: "8", search: "auth" });
      const res = await adminFetch(`/api/admin/audit?${qs}`);
      const json = (await res.json()) as ApiResponse<PaginatedResult<AuditLogEntry>>;
      if (!json.success) throw new Error("Failed to load audit logs");
      return json.data.items;
    },
  });

  const security = settings?.security ?? {};
  const [form, setForm] = React.useState({
    passwordMinLength: "12",
    sessionTimeoutMinutes: "720",
    require2faForAdmins: true,
  });

  React.useEffect(() => {
    if (!settings?.security) return;
    setForm({
      passwordMinLength: String(security.passwordMinLength ?? 12),
      sessionTimeoutMinutes: String(security.sessionTimeoutMinutes ?? 720),
      require2faForAdmins: Boolean(security.require2faForAdmins),
    });
  }, [settings?.security, security.passwordMinLength, security.require2faForAdmins, security.sessionTimeoutMinutes]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "security",
          values: {
            passwordMinLength: Number(form.passwordMinLength),
            sessionTimeoutMinutes: Number(form.sessionTimeoutMinutes),
            require2faForAdmins: form.require2faForAdmins,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Save failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Security policy saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell
      title="Security"
      description="Password policy, admin 2FA posture, and recent auth audit events"
      actions={
        <Button asChild variant="outline">
          <Link href="/orbit/settings">All settings</Link>
        </Button>
      }
    >
      {settingsLoading ? <Loading label="Loading security policy" /> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassPanel className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-gold" />
            <h2 className="font-display text-xl font-semibold">Password & session policy</h2>
          </div>
          <div className="space-y-2">
            <Label>Minimum password length</Label>
            <Input
              value={form.passwordMinLength}
              onChange={(e) => setForm((f) => ({ ...f, passwordMinLength: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Session timeout (minutes)</Label>
            <Input
              value={form.sessionTimeoutMinutes}
              onChange={(e) => setForm((f) => ({ ...f, sessionTimeoutMinutes: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.require2faForAdmins}
              onChange={(e) =>
                setForm((f) => ({ ...f, require2faForAdmins: e.target.checked }))
              }
            />
            Require 2FA for admin roles
          </label>
          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save policy"}
          </Button>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h2 className="mb-4 font-display text-xl font-semibold">Recent auth audit</h2>
          {auditLoading ? <Loading label="Loading audit" /> : null}
          {!auditLoading && audit?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No auth-related audit entries yet.</p>
          ) : null}
          {audit && audit.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.action}</TableCell>
                    <TableCell className="text-xs">{log.actorEmail ?? "system"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
          <Button asChild variant="link" className="mt-4 px-0">
            <Link href="/orbit/logs">View full audit log</Link>
          </Button>
        </GlassPanel>
      </div>
    </AdminShell>
  );
}

export function ApiAdminPage() {
  const { data: health, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["public-health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("Health check failed");
      return json.data as { status: string; version: string; timestamp: string };
    },
  });

  return (
    <AdminShell
      title="API"
      description="Live REST surface for Orbit admin and platform health"
      actions={
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className="size-4" />
          Ping health
        </Button>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="Health"
          value={isLoading ? "…" : (health?.status ?? "—")}
          hint={health?.timestamp ? new Date(health.timestamp).toLocaleString() : "GET /api/health"}
          icon={HeartPulse}
        />
        <StatsCard title="Version" value={health?.version ?? appConfig.version} hint="App release" icon={Layers} />
        <StatsCard title="Phase" value={String(appConfig.phase)} hint="Deployment phase" icon={Activity} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {API_ENDPOINTS.map((section) => (
          <GlassPanel key={section.group} className="p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">{section.group}</h2>
            <ul className="space-y-2">
              {section.routes.map((route) => (
                <li
                  key={route}
                  className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 font-mono text-xs"
                >
                  {route}
                </li>
              ))}
            </ul>
          </GlassPanel>
        ))}
      </div>
    </AdminShell>
  );
}

export function SystemAdminPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/system");
      const json = (await res.json()) as ApiResponse<SystemHealthReport>;
      if (!json.success) throw new Error(json.message ?? "System health failed");
      return json.data;
    },
    refetchInterval: 30_000,
  });

  return (
    <AdminShell
      title="System"
      description="Live platform health — database, mail stack, and host metrics"
      actions={
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      }
    >
      {isLoading ? <Loading label="Checking system health" /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard title="CPU" value={data.cpuPercent == null ? "—" : `${data.cpuPercent}%`} icon={Cpu} />
            <StatsCard title="RAM" value={data.ramPercent == null ? "—" : `${data.ramPercent}%`} icon={Database} />
            <StatsCard title="Disk" value={data.diskPercent == null ? "—" : `${data.diskPercent}%`} icon={HardDrive} />
            <StatsCard title="Provision mode" value={data.provisionMode} icon={Activity} />
          </div>
          <p className="text-xs text-muted-foreground">
            Last checked {new Date(data.checkedAt).toLocaleString()}
          </p>
          <div className="glass-surface space-y-3 rounded-2xl p-5">
            <h2 className="font-display text-xl font-semibold">Components</h2>
            {data.components.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 p-3"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.detail}</p>
                </div>
                <StatusPill label={c.status} tone={statusToneFromValue(c.status)} />
              </div>
            ))}
          </div>
          <Button asChild variant="outline">
            <Link href="/orbit/monitoring">Open monitoring dashboard</Link>
          </Button>
        </div>
      ) : null}
    </AdminShell>
  );
}

export function SupportAdminPage() {
  const [search, setSearch] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-support-customers", search],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: "1", pageSize: "10", search });
      const res = await adminFetch(`/api/admin/customers?${qs}`);
      const json = (await res.json()) as ApiResponse<PaginatedResult<AdminCustomer>>;
      if (!json.success) throw new Error("Customer lookup failed");
      return json.data.items;
    },
  });

  return (
    <AdminShell
      title="Support"
      description="Customer lookup for support staff — live data from PostgreSQL"
    >
      <SearchInput
        containerClassName="mb-4 max-w-md"
        placeholder="Search by email, name, or organization…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {isLoading ? <Loading label="Searching customers" /> : null}
      {!isLoading && data?.length === 0 ? (
        <GlassPanel className="p-8 text-center text-sm text-muted-foreground">
          No customers match your search.
        </GlassPanel>
      ) : null}
      {data && data.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <p className="font-medium">{customer.email}</p>
                    <p className="text-xs text-muted-foreground">{customer.name ?? "—"}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {customer.organizationName ?? "—"}
                    {customer.organizationStatus ? (
                      <span className="block text-xs text-muted-foreground">
                        {customer.organizationStatus}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{customer.planName ?? "—"}</TableCell>
                  <TableCell>
                    <StatusPill label={customer.status} tone={statusToneFromValue(customer.status)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/orbit/customers">
                        <Search className="size-3.5" />
                        Customers
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">
        Support email: {appConfig.supportEmail}
      </p>
    </AdminShell>
  );
}

export function DocumentationAdminPage() {
  return (
    <AdminShell
      title="Documentation"
      description="Operator runbooks and links to live Orbit modules"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {RUNBOOK.map((doc) => (
          <GlassPanel key={doc.title} className="space-y-3 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">{doc.title}</h2>
              <Button asChild size="sm" variant="outline">
                <Link href={doc.href}>
                  Open
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {doc.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </GlassPanel>
        ))}
      </div>

      <GlassPanel className="mt-6 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Module index</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-muted/30"
            >
              {item.title}
            </Link>
          ))}
        </div>
      </GlassPanel>
    </AdminShell>
  );
}
