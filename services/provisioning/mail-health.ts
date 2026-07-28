/**
 * Orbit Mail Health — live checks for domains + mailboxes against MariaDB / SMTP / IMAP / DNS / Maildir.
 */

import { createConnection } from "node:net";
import { prisma } from "@/lib/db";
import { maildirExists } from "@/services/provisioning/maildir";
import {
  isMysqlMailAuthConfigured,
  mysqlVirtualDomainExists,
  mysqlVirtualUserExists,
} from "@/services/provisioning/mysql-mail-auth";

export type HealthTone = "ok" | "warn" | "fail" | "skip";

export type HealthCheck = {
  key: string;
  label: string;
  ok: boolean;
  tone: HealthTone;
  detail: string;
};

export type MailboxHealthRow = {
  mailboxId: string;
  email: string;
  domainId: string;
  domain: string;
  checks: HealthCheck[];
  status: "healthy" | "degraded" | "unhealthy";
};

export type DomainHealthRow = {
  domainId: string;
  domain: string;
  mailStatus: string;
  dnsStatus: string;
  provisionedAt: string | null;
  checks: HealthCheck[];
  status: "healthy" | "degraded" | "unhealthy";
  mailboxes: MailboxHealthRow[];
};

export type MailHealthReport = {
  checkedAt: string;
  mysqlConfigured: boolean;
  smtpPort: { ok: boolean; detail: string };
  imapPort: { ok: boolean; detail: string };
  domains: DomainHealthRow[];
  summary: {
    domains: number;
    mailboxes: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
};

function toneFrom(ok: boolean, skip = false): HealthTone {
  if (skip) return "skip";
  return ok ? "ok" : "fail";
}

function rollupStatus(checks: HealthCheck[]): "healthy" | "degraded" | "unhealthy" {
  const actionable = checks.filter((c) => c.tone !== "skip");
  if (actionable.length === 0) return "degraded";
  if (actionable.every((c) => c.ok)) return "healthy";
  if (actionable.some((c) => c.ok)) return "degraded";
  return "unhealthy";
}

async function tcpOpen(
  host: string,
  port: number,
  label: string,
  timeoutMs = 5000,
): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, detail: `${label} ${host}:${port} timed out` });
    }, timeoutMs);
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: true, detail: `${label} ${host}:${port} open` });
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, detail: `${label} ${host}:${port} — ${err.message}` });
    });
  });
}

function latestVerificationState(
  rows: { kind: string; state: string; detail: string | null }[],
  kind: string,
): { ok: boolean; detail: string } {
  const row = rows.find((r) => r.kind === kind);
  if (!row) return { ok: false, detail: `${kind} not checked yet` };
  return {
    ok: row.state === "VERIFIED",
    detail: row.detail || `${kind}: ${row.state}`,
  };
}

export async function collectMailHealth(): Promise<MailHealthReport> {
  const smtpHost = process.env.MAIL_SMTP_HOST?.trim() || "127.0.0.1";
  const imapHost = process.env.WEBMAIL_IMAP_HOST?.trim() || "127.0.0.1";
  const smtpPort = await tcpOpen(smtpHost, Number(process.env.MAIL_SMTP_PORT ?? "25"), "SMTP");
  const imapPort = await tcpOpen(imapHost, Number(process.env.WEBMAIL_IMAP_PORT ?? "143"), "IMAP");

  const domains = await prisma.domain.findMany({
    where: { deletedAt: null, status: { notIn: ["SUSPENDED", "FAILED"] } },
    include: {
      mailboxes: {
        where: { deletedAt: null, status: { not: "DISABLED" } },
        include: { quota: true },
        orderBy: { localPart: "asc" },
      },
      verifications: {
        orderBy: { checkedAt: "desc" },
        take: 20,
      },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  const mysqlConfigured = isMysqlMailAuthConfigured();
  const domainRows: DomainHealthRow[] = [];

  for (const domain of domains) {
    const verifications = domain.verifications.map((v) => ({
      kind: v.kind,
      state: v.state,
      detail: v.detail,
    }));

    const domainMysql = mysqlConfigured
      ? await mysqlVirtualDomainExists(domain.name)
      : { ok: false, exists: false, error: "MySQL not configured" };

    const spf = latestVerificationState(verifications, "DNS_SPF");
    const dkim = latestVerificationState(verifications, "DNS_DKIM");
    const dmarc = latestVerificationState(verifications, "DNS_DMARC");
    const mx = latestVerificationState(verifications, "DNS_MX");

    const domainChecks: HealthCheck[] = [
      {
        key: "virtual_domains",
        label: "Domain (virtual_domains)",
        ok: domainMysql.exists,
        tone: toneFrom(domainMysql.exists, !mysqlConfigured),
        detail: mysqlConfigured
          ? domainMysql.exists
            ? "Present in MariaDB virtual_domains"
            : domainMysql.error || "Missing from virtual_domains"
          : "MySQL not configured on this host",
      },
      {
        key: "smtp",
        label: "SMTP (tcp 25)",
        ok: smtpPort.ok,
        tone: toneFrom(smtpPort.ok),
        detail: smtpPort.detail,
      },
      {
        key: "imap",
        label: "IMAP (tcp 143)",
        ok: imapPort.ok,
        tone: toneFrom(imapPort.ok),
        detail: imapPort.detail,
      },
      {
        key: "mx",
        label: "MX",
        ok: mx.ok,
        tone: toneFrom(mx.ok),
        detail: mx.detail,
      },
      {
        key: "spf",
        label: "SPF",
        ok: spf.ok,
        tone: toneFrom(spf.ok),
        detail: spf.detail,
      },
      {
        key: "dkim",
        label: "DKIM",
        ok: dkim.ok,
        tone: toneFrom(dkim.ok),
        detail: dkim.detail,
      },
      {
        key: "dmarc",
        label: "DMARC",
        ok: dmarc.ok,
        tone: dmarc.ok ? "ok" : "warn",
        detail: dmarc.detail,
      },
      {
        key: "provisioned",
        label: "Provisioned",
        ok: Boolean(domain.provisionedAt) && domain.mailStatus === "ACTIVE",
        tone: toneFrom(Boolean(domain.provisionedAt) && domain.mailStatus === "ACTIVE"),
        detail: domain.provisionedAt
          ? `mailStatus=${domain.mailStatus}; provisionedAt=${domain.provisionedAt.toISOString()}`
          : `mailStatus=${domain.mailStatus}; provisionedAt=null`,
      },
    ];

    const mailboxRows: MailboxHealthRow[] = [];
    for (const mb of domain.mailboxes) {
      const email = `${mb.localPart}@${domain.name}`.toLowerCase();
      const userMysql = mysqlConfigured
        ? await mysqlVirtualUserExists(email)
        : { ok: false, exists: false, hasQuota: false, error: "MySQL not configured" };
      const dirOk = maildirExists(email);

      const checks: HealthCheck[] = [
        {
          key: "virtual_users",
          label: "Mailbox (virtual_users)",
          ok: userMysql.exists,
          tone: toneFrom(userMysql.exists, !mysqlConfigured),
          detail: mysqlConfigured
            ? userMysql.exists
              ? "Present in MariaDB virtual_users"
              : userMysql.error || "Missing from virtual_users"
            : "MySQL not configured on this host",
        },
        {
          key: "smtp",
          label: "SMTP (tcp 25)",
          ok: smtpPort.ok,
          tone: toneFrom(smtpPort.ok),
          detail: smtpPort.detail,
        },
        {
          key: "imap",
          label: "IMAP (tcp 143)",
          ok: imapPort.ok,
          tone: toneFrom(imapPort.ok),
          detail: imapPort.detail,
        },
        {
          key: "maildir",
          label: "Maildir",
          ok: dirOk,
          tone: toneFrom(dirOk),
          detail: dirOk ? "cur/new/tmp present" : "Maildir layout missing",
        },
        {
          key: "quota",
          label: "Quota row",
          ok: userMysql.hasQuota || (mb.quota?.quotaMb ?? 0) > 0,
          tone:
            userMysql.hasQuota || (mb.quota?.quotaMb ?? 0) > 0
              ? "ok"
              : mysqlConfigured
                ? "warn"
                : "skip",
          detail: userMysql.hasQuota
            ? "virtual_users.quota set"
            : mb.quota
              ? `Orbit quota ${mb.quota.quotaMb} MB (MariaDB quota column ${mysqlConfigured ? "empty/missing" : "n/a"})`
              : "No quota configured",
        },
        {
          key: "dns",
          label: "DKIM/SPF/DMARC",
          ok: spf.ok && dkim.ok,
          tone: spf.ok && dkim.ok ? "ok" : dmarc.ok || spf.ok || dkim.ok ? "warn" : "fail",
          detail: `SPF=${spf.ok ? "ok" : "fail"}; DKIM=${dkim.ok ? "ok" : "fail"}; DMARC=${dmarc.ok ? "ok" : "fail"}`,
        },
      ];

      mailboxRows.push({
        mailboxId: mb.id,
        email,
        domainId: domain.id,
        domain: domain.name,
        checks,
        status: rollupStatus(checks),
      });
    }

    domainRows.push({
      domainId: domain.id,
      domain: domain.name,
      mailStatus: domain.mailStatus,
      dnsStatus: domain.dnsStatus,
      provisionedAt: domain.provisionedAt?.toISOString() ?? null,
      checks: domainChecks,
      status: rollupStatus(domainChecks),
      mailboxes: mailboxRows,
    });
  }

  const allStatuses = [
    ...domainRows.map((d) => d.status),
    ...domainRows.flatMap((d) => d.mailboxes.map((m) => m.status)),
  ];

  return {
    checkedAt: new Date().toISOString(),
    mysqlConfigured,
    smtpPort,
    imapPort,
    domains: domainRows,
    summary: {
      domains: domainRows.length,
      mailboxes: domainRows.reduce((n, d) => n + d.mailboxes.length, 0),
      healthy: allStatuses.filter((s) => s === "healthy").length,
      degraded: allStatuses.filter((s) => s === "degraded").length,
      unhealthy: allStatuses.filter((s) => s === "unhealthy").length,
    },
  };
}
