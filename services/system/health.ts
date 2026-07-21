import { createConnection } from "node:net";
import { cpus } from "node:os";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/lib/db";
import { mailEngine } from "@/services/provisioning/mail-engine";
import { writeAudit } from "@/lib/audit";

const execFileAsync = promisify(execFile);

export type HealthStatus = "operational" | "degraded" | "down" | "unknown";

export type HealthComponent = {
  id: string;
  name: string;
  status: HealthStatus;
  detail: string;
  latencyMs?: number;
};

export type SystemHealthReport = {
  checkedAt: string;
  provisionMode: string;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  components: HealthComponent[];
};

function tcpCheck(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function checkPostgres(): Promise<HealthComponent> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      id: "database",
      name: "Database",
      status: "operational",
      detail: "PostgreSQL accepting queries",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      id: "database",
      name: "Database",
      status: "down",
      detail: error instanceof Error ? error.message : "Database unreachable",
      latencyMs: Date.now() - start,
    };
  }
}

async function checkRedis(): Promise<HealthComponent> {
  const url = process.env.REDIS_URL ?? "";
  const host = process.env.REDIS_HOST ?? "127.0.0.1";
  const port = Number(process.env.REDIS_PORT ?? "6379");
  if (!url && process.env.REDIS_REQUIRED === "false") {
    return {
      id: "redis",
      name: "Redis",
      status: "unknown",
      detail: "REDIS_URL not configured (optional)",
    };
  }
  const start = Date.now();
  const ok = await tcpCheck(host, port);
  return {
    id: "redis",
    name: "Redis",
    status: ok ? "operational" : "down",
    detail: ok ? `TCP ${host}:${port} open` : `Cannot reach Redis at ${host}:${port}`,
    latencyMs: Date.now() - start,
  };
}

async function checkHttp(id: string, name: string, url: string): Promise<HealthComponent> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    return {
      id,
      name,
      status: res.ok || res.status < 500 ? "operational" : "degraded",
      detail: `HTTP ${res.status} from ${url}`,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      id,
      name,
      status: "down",
      detail: error instanceof Error ? error.message : `Failed ${url}`,
      latencyMs: Date.now() - start,
    };
  }
}

async function checkTcpService(
  id: string,
  name: string,
  host: string,
  port: number,
): Promise<HealthComponent> {
  const start = Date.now();
  const ok = await tcpCheck(host, port);
  return {
    id,
    name,
    status: ok ? "operational" : "down",
    detail: ok ? `Listening on ${host}:${port}` : `Not reachable on ${host}:${port}`,
    latencyMs: Date.now() - start,
  };
}

async function readLocalMetrics(): Promise<{
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
}> {
  if (process.platform !== "linux") {
    return { cpuPercent: null, ramPercent: null, diskPercent: null };
  }
  try {
    const meminfo = await readFile("/proc/meminfo", "utf8");
    const total = Number(/MemTotal:\s+(\d+)/.exec(meminfo)?.[1] ?? 0);
    const available = Number(/MemAvailable:\s+(\d+)/.exec(meminfo)?.[1] ?? 0);
    const ramPercent =
      total > 0 ? Number((((total - available) / total) * 100).toFixed(1)) : null;

    let diskPercent: number | null = null;
    try {
      const { stdout } = await execFileAsync("df", ["-P", "/"]);
      const line = stdout.trim().split("\n")[1] ?? "";
      const pct = /(\d+)%/.exec(line)?.[1];
      diskPercent = pct ? Number(pct) : null;
    } catch {
      diskPercent = null;
    }

    let cpuPercent: number | null = null;
    try {
      const load = await readFile("/proc/loadavg", "utf8");
      const one = Number(load.split(" ")[0] ?? 0);
      const cpuCount = cpus().length;
      cpuPercent = cpuCount > 0 ? Number(Math.min(100, (one / cpuCount) * 100).toFixed(1)) : null;
    } catch {
      cpuPercent = null;
    }

    return { cpuPercent, ramPercent, diskPercent };
  } catch {
    return { cpuPercent: null, ramPercent: null, diskPercent: null };
  }
}

export const systemHealthService = {
  async getReport(actorId?: string | null, options?: { audit?: boolean }): Promise<SystemHealthReport> {
    const mailHost = process.env.MAIL_HOSTNAME ?? "127.0.0.1";
    const webmailUrl =
      process.env.WEBMAIL_HEALTH_URL ??
      process.env.NEXT_PUBLIC_USER_PORTAL_URL ??
      "https://webmail.globalorbitmail.cloud";
    const phpFpmHost = process.env.PHP_FPM_HOST ?? "127.0.0.1";
    const phpFpmPort = Number(process.env.PHP_FPM_PORT ?? "9000");
    const nginxHost = process.env.NGINX_HEALTH_HOST ?? "127.0.0.1";
    const nginxPort = Number(process.env.NGINX_HEALTH_PORT ?? "80");

    const [database, redis, postfix, dovecot, rspamd, nginx, php, roundcube, metrics] =
      await Promise.all([
        checkPostgres(),
        checkRedis(),
        checkTcpService("postfix", "Postfix", mailHost, Number(process.env.POSTFIX_SMTP_PORT ?? "25")),
        checkTcpService("dovecot", "Dovecot", mailHost, Number(process.env.DOVECOT_IMAP_PORT ?? "143")),
        checkTcpService("rspamd", "Rspamd", process.env.RSPAMD_HOST ?? "127.0.0.1", Number(process.env.RSPAMD_PORT ?? "11334")),
        checkTcpService("nginx", "Nginx", nginxHost, nginxPort),
        checkTcpService("php", "PHP", phpFpmHost, phpFpmPort),
        checkHttp("roundcube", "Roundcube", webmailUrl),
        readLocalMetrics(),
      ]);

    if (mailEngine.isEnabled()) {
      const agent = await mailEngine.execute({ command: "health.check", payload: {} });
      if (agent.ok && agent.data) {
        if (typeof agent.data.cpuPercent === "number") metrics.cpuPercent = agent.data.cpuPercent;
        if (typeof agent.data.ramPercent === "number") metrics.ramPercent = agent.data.ramPercent;
        if (typeof agent.data.diskPercent === "number") metrics.diskPercent = agent.data.diskPercent;
      }
    }

    const components = [database, redis, postfix, dovecot, rspamd, nginx, php, roundcube];

    if (options?.audit !== false && actorId) {
      await writeAudit({
        actorId,
        action: "system.health",
        resource: "system",
        metadata: {
          components: components.map((c) => ({ id: c.id, status: c.status })),
        },
      });
    }

    return {
      checkedAt: new Date().toISOString(),
      provisionMode: mailEngine.getMode(),
      cpuPercent: metrics.cpuPercent,
      ramPercent: metrics.ramPercent,
      diskPercent: metrics.diskPercent,
      components,
    };
  },
};
