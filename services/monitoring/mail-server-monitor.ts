/**
 * Live mail-server monitor — queue, failures, load, services, mail-health rollup.
 */

import { mailEngine } from "@/services/provisioning/mail-engine";
import { collectMailHealth } from "@/services/provisioning/mail-health";
import { systemHealthService } from "@/services/system/health";

export type MailServerMonitorSnapshot = {
  checkedAt: string;
  queueCount: number;
  queueSample: string[];
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  loadAvg: string[];
  services: Record<string, string>;
  recentFailures: string[];
  slowDeliveries: string[];
  recentLogTail: string[];
  mailHealthSummary: {
    domains: number;
    mailboxes: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  unhealthyMailboxes: Array<{ email: string; domain: string; status: string; issues: string[] }>;
  agentOk: boolean;
  agentError?: string;
};

function parseAgentMonitor(data: Record<string, unknown> | undefined): Partial<MailServerMonitorSnapshot> {
  if (!data) return {};
  return {
    checkedAt: typeof data.checkedAt === "string" ? data.checkedAt : new Date().toISOString(),
    queueCount: typeof data.queueCount === "number" ? data.queueCount : 0,
    queueSample: Array.isArray(data.queueSample) ? data.queueSample.map(String) : [],
    cpuPercent: typeof data.cpuPercent === "number" ? data.cpuPercent : null,
    ramPercent: typeof data.ramPercent === "number" ? data.ramPercent : null,
    diskPercent: typeof data.diskPercent === "number" ? data.diskPercent : null,
    loadAvg: Array.isArray(data.loadAvg) ? data.loadAvg.map(String) : [],
    services:
      data.services && typeof data.services === "object"
        ? (data.services as Record<string, string>)
        : {},
    recentFailures: Array.isArray(data.recentFailures) ? data.recentFailures.map(String) : [],
    slowDeliveries: Array.isArray(data.slowDeliveries) ? data.slowDeliveries.map(String) : [],
    recentLogTail: Array.isArray(data.recentLogTail) ? data.recentLogTail.map(String) : [],
  };
}

export const mailServerMonitorService = {
  async getSnapshot(): Promise<MailServerMonitorSnapshot> {
    const [agentResult, mailHealth, systemHealth] = await Promise.all([
      mailEngine.getMonitorSnapshot().catch(
        (error): { ok: false; stderr: string; data?: undefined } => ({
          ok: false,
          stderr: error instanceof Error ? error.message : "monitor agent failed",
        }),
      ),
      collectMailHealth().catch(() => null),
      systemHealthService.getReport(null, { audit: false }).catch(() => null),
    ]);

    const agentData = parseAgentMonitor(
      agentResult.ok ? (agentResult.data as Record<string, unknown>) : undefined,
    );

    const unhealthyMailboxes =
      mailHealth?.domains.flatMap((d) =>
        d.mailboxes
          .filter((m) => m.status !== "healthy")
          .map((m) => ({
            email: m.email,
            domain: m.domain,
            status: m.status,
            issues: m.checks.filter((c) => !c.ok && c.tone !== "skip").map((c) => `${c.label}: ${c.detail}`),
          })),
      ) ?? [];

    return {
      checkedAt: agentData.checkedAt ?? new Date().toISOString(),
      queueCount: agentData.queueCount ?? 0,
      queueSample: agentData.queueSample ?? [],
      cpuPercent: agentData.cpuPercent ?? systemHealth?.cpuPercent ?? null,
      ramPercent: agentData.ramPercent ?? systemHealth?.ramPercent ?? null,
      diskPercent: agentData.diskPercent ?? systemHealth?.diskPercent ?? null,
      loadAvg: agentData.loadAvg ?? [],
      services: {
        // Prefer accurate agent mail-stack status; overlay system health for DB/etc.
        ...Object.fromEntries(
          (systemHealth?.components ?? []).map((c) => [
            c.id,
            c.status === "operational" ? "active" : c.status === "unknown" ? "unknown" : c.status,
          ]),
        ),
        ...(agentData.services ?? {}),
      },
      // Prefer agent-filtered real failures (noise already stripped on VPS)
      recentFailures: agentData.recentFailures ?? [],
      slowDeliveries: agentData.slowDeliveries ?? [],
      recentLogTail: agentData.recentLogTail ?? [],
      mailHealthSummary: mailHealth?.summary ?? {
        domains: 0,
        mailboxes: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
      },
      unhealthyMailboxes,
      agentOk: agentResult.ok,
      agentError: agentResult.ok ? undefined : agentResult.stderr || "Agent monitor unavailable",
    };
  },

  async flushQueue(): Promise<{ ok: boolean; detail: string }> {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    try {
      await exec("postqueue", ["-f"]);
      return { ok: true, detail: "Postfix queue flush triggered (postqueue -f)" };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : "Queue flush failed",
      };
    }
  },
};
