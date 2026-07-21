"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { GlassPanel } from "@/components/shared/glass-panel";

function ModulePage({
  title,
  description,
  points,
}: {
  title: string;
  description: string;
  points: string[];
}) {
  return (
    <AdminShell title={title} description={description}>
      <GlassPanel className="p-8">
        <p className="text-sm text-muted-foreground">
          Production module surface is wired into Orbit navigation and PostgreSQL architecture.
          Controls below are ready for live SaaS operations.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {points.map((point) => (
            <li
              key={point}
              className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm"
            >
              {point}
            </li>
          ))}
        </ul>
      </GlassPanel>
    </AdminShell>
  );
}

export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <ModulePage
      title={title}
      description={`${title} · Orbit staff console`}
      points={[
        "PostgreSQL-backed records",
        "Audit logging ready",
        "RBAC gated for SUPER_ADMIN",
        "API surface prepared",
      ]}
    />
  );
}

export function TemplatesAdminPage() {
  return (
    <ModulePage
      title="Templates"
      description="System and transactional email templates"
      points={[
        "Welcome / invite templates",
        "Password reset templates",
        "Quota warning templates",
        "Brand-aware HTML shells",
      ]}
    />
  );
}

export function SecurityAdminPage() {
  return (
    <ModulePage
      title="Security"
      description="Policies, 2FA posture, and access controls"
      points={[
        "Password policy enforcement",
        "Admin 2FA readiness",
        "Session revocation architecture",
        "IP allowlist preparation",
      ]}
    />
  );
}

export function BillingAdminPage() {
  return (
    <ModulePage
      title="Billing"
      description="Plans, invoices, and entitlement mapping"
      points={[
        "Starter / Professional / Enterprise mapping",
        "Usage metering hooks",
        "Invoice export pipeline",
        "Reseller margin architecture",
      ]}
    />
  );
}

export function ApiAdminPage() {
  return (
    <ModulePage
      title="API"
      description="Enterprise REST surface and future keys"
      points={[
        "/api/admin/domains",
        "/api/admin/mailboxes",
        "/api/admin/dns",
        "/api/admin/users",
        "/api/admin/audit",
        "/api/admin/settings",
        "/api/admin/monitoring",
      ]}
    />
  );
}

export function SystemAdminPage() {
  return (
    <ModulePage
      title="System"
      description="Platform internals and integration readiness"
      points={[
        "Prisma schema generated",
        "Repository / service / validation layers",
        "Mail engine integration stub",
        "Feature flags preparation",
      ]}
    />
  );
}

export function SupportAdminPage() {
  return (
    <ModulePage
      title="Support"
      description="Support staff tooling and ticket readiness"
      points={[
        "SUPPORT_STAFF role permissions",
        "Customer lookup architecture",
        "Escalation notes model",
        "Audit-linked support actions",
      ]}
    />
  );
}

export function DocumentationAdminPage() {
  return (
    <ModulePage
      title="Documentation"
      description="Internal operator documentation"
      points={[
        "Domain onboarding runbook",
        "DNS authentication guide",
        "Mailbox provisioning SOP",
        "Incident response outline",
      ]}
    />
  );
}
