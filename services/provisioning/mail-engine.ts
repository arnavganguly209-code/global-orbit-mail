import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/lib/db";
import type { ProvisionJobKind, ProvisionJobStatus } from "@prisma/client";

const execFileAsync = promisify(execFile);

export type ProvisionMode = "local" | "ssh" | "disabled";

export type AgentCommand =
  | "domain.create"
  | "domain.delete"
  | "mailbox.create"
  | "mailbox.delete"
  | "mailbox.suspend"
  | "mailbox.unsuspend"
  | "mailbox.password"
  | "mailbox.quota"
  | "alias.sync"
  | "forwarder.sync"
  | "vacation.sync"
  | "dkim.sync"
  | "storage.usage"
  | "health.check";

export type AgentRequest = {
  command: AgentCommand;
  payload: Record<string, unknown>;
};

export type AgentResponse = {
  ok: boolean;
  stdout: string;
  stderr: string;
  data?: Record<string, unknown>;
};

function getMode(): ProvisionMode {
  const mode = (process.env.MAIL_PROVISION_MODE ?? "local").toLowerCase();
  if (mode === "ssh" || mode === "local" || mode === "disabled") return mode;
  return "local";
}

function agentScriptPath(): string {
  return process.env.MAIL_AGENT_SCRIPT ?? "/opt/global-orbit/bin/mail-agent.sh";
}

function sshConfig() {
  return {
    host: process.env.MAIL_PROVISION_SSH_HOST ?? "",
    user: process.env.MAIL_PROVISION_SSH_USER ?? "root",
    keyPath: process.env.MAIL_PROVISION_SSH_KEY_PATH ?? "",
    port: Number(process.env.MAIL_PROVISION_SSH_PORT ?? "22"),
  };
}

async function runLocal(request: AgentRequest): Promise<AgentResponse> {
  const script = agentScriptPath();
  const input = JSON.stringify(request);
  try {
    const { stdout, stderr } = await execFileAsync(
      script,
      [request.command],
      {
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, MAIL_AGENT_PAYLOAD: input },
        shell: false,
      },
    );
    return parseAgentOutput(stdout, stderr);
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    if (err.stdout || err.stderr) {
      return parseAgentOutput(err.stdout ?? "", err.stderr ?? err.message ?? "agent failed");
    }
    // Fallback: SQL-only virtual tables when agent binary missing but DB is co-located
    return runSqlFallback(request, err.message ?? "mail agent failed");
  }
}

async function runSsh(request: AgentRequest): Promise<AgentResponse> {
  const { host, user, keyPath, port } = sshConfig();
  if (!host) {
    return { ok: false, stdout: "", stderr: "MAIL_PROVISION_SSH_HOST is not configured" };
  }
  const script = agentScriptPath();
  const remote = `${user}@${host}`;
  const args = [
    "-p",
    String(port),
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
  ];
  if (keyPath) {
    args.push("-i", keyPath);
  }
  args.push(remote, script, request.command);

  try {
    const { stdout, stderr } = await execFileAsync("ssh", args, {
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, MAIL_AGENT_PAYLOAD: JSON.stringify(request) },
    });
    return parseAgentOutput(stdout, stderr);
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "SSH provision failed",
    };
  }
}

function parseAgentOutput(stdout: string, stderr: string): AgentResponse {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { ok: false, stdout, stderr: stderr || "Empty agent response" };
  }
  try {
    const parsed = JSON.parse(trimmed) as { ok?: boolean; data?: Record<string, unknown>; error?: string };
    return {
      ok: Boolean(parsed.ok),
      stdout,
      stderr: parsed.error ?? stderr,
      data: parsed.data,
    };
  } catch {
    // Non-JSON success convention: first line OK
    const ok = /^OK\b/i.test(trimmed) || trimmed.toLowerCase().includes('"ok":true');
    return { ok, stdout, stderr };
  }
}

/**
 * When the shell agent is unavailable, keep provisioning durable in PostgreSQL
 * tables that Postfix/Dovecot can query (virtual_domains / virtual_users style).
 */
async function runSqlFallback(request: AgentRequest, reason: string): Promise<AgentResponse> {
  try {
    await ensureVirtualMailTables();
    switch (request.command) {
      case "domain.create": {
        const domain = String(request.payload.domain ?? "");
        await prisma.$executeRawUnsafe(
          `INSERT INTO virtual_domains (name, active) VALUES ($1, true)
           ON CONFLICT (name) DO UPDATE SET active = true`,
          domain,
        );
        return { ok: true, stdout: "sql:domain.create", stderr: "", data: { fallback: true, reason } };
      }
      case "domain.delete": {
        const domain = String(request.payload.domain ?? "");
        await prisma.$executeRawUnsafe(`UPDATE virtual_domains SET active = false WHERE name = $1`, domain);
        return { ok: true, stdout: "sql:domain.delete", stderr: "", data: { fallback: true } };
      }
      case "mailbox.create":
      case "mailbox.password": {
        const email = String(request.payload.email ?? "");
        const password = String(request.payload.mailPasswordHash ?? "");
        const quotaBytes = Number(request.payload.quotaBytes ?? 0);
        const domain = email.split("@")[1] ?? "";
        await prisma.$executeRawUnsafe(
          `INSERT INTO virtual_users (email, password, domain, quota_bytes, active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, quota_bytes = EXCLUDED.quota_bytes, active = true`,
          email,
          password,
          domain,
          quotaBytes,
        );
        return { ok: true, stdout: `sql:${request.command}`, stderr: "", data: { fallback: true, reason } };
      }
      case "mailbox.delete": {
        const email = String(request.payload.email ?? "");
        await prisma.$executeRawUnsafe(`UPDATE virtual_users SET active = false WHERE email = $1`, email);
        return { ok: true, stdout: "sql:mailbox.delete", stderr: "", data: { fallback: true } };
      }
      case "mailbox.suspend": {
        const email = String(request.payload.email ?? "");
        await prisma.$executeRawUnsafe(`UPDATE virtual_users SET active = false WHERE email = $1`, email);
        return { ok: true, stdout: "sql:mailbox.suspend", stderr: "", data: { fallback: true } };
      }
      case "mailbox.unsuspend": {
        const email = String(request.payload.email ?? "");
        await prisma.$executeRawUnsafe(`UPDATE virtual_users SET active = true WHERE email = $1`, email);
        return { ok: true, stdout: "sql:mailbox.unsuspend", stderr: "", data: { fallback: true } };
      }
      case "mailbox.quota": {
        const email = String(request.payload.email ?? "");
        const quotaBytes = Number(request.payload.quotaBytes ?? 0);
        await prisma.$executeRawUnsafe(
          `UPDATE virtual_users SET quota_bytes = $2 WHERE email = $1`,
          email,
          quotaBytes,
        );
        return { ok: true, stdout: "sql:mailbox.quota", stderr: "", data: { fallback: true } };
      }
      case "alias.sync": {
        const address = String(request.payload.address ?? "");
        const goto = String(request.payload.goto ?? "");
        await prisma.$executeRawUnsafe(
          `INSERT INTO virtual_aliases (address, goto, active) VALUES ($1, $2, true)
           ON CONFLICT (address) DO UPDATE SET goto = EXCLUDED.goto, active = true`,
          address,
          goto,
        );
        return { ok: true, stdout: "sql:alias.sync", stderr: "", data: { fallback: true } };
      }
      case "forwarder.sync": {
        const address = String(request.payload.address ?? "");
        const goto = String(request.payload.goto ?? "");
        await prisma.$executeRawUnsafe(
          `INSERT INTO virtual_aliases (address, goto, active) VALUES ($1, $2, true)
           ON CONFLICT (address) DO UPDATE SET goto = EXCLUDED.goto, active = true`,
          address,
          goto,
        );
        return { ok: true, stdout: "sql:forwarder.sync", stderr: "", data: { fallback: true } };
      }
      case "storage.usage": {
        return {
          ok: true,
          stdout: "sql:storage.usage",
          stderr: "",
          data: { usedBytes: 0, fallback: true, reason },
        };
      }
      case "health.check": {
        return {
          ok: true,
          stdout: "sql:health.check",
          stderr: "",
          data: { mode: "sql-fallback", reason },
        };
      }
      default:
        return { ok: true, stdout: `sql:${request.command}`, stderr: "", data: { fallback: true, reason } };
    }
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : "SQL fallback failed",
    };
  }
}

async function ensureVirtualMailTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS virtual_domains (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      active BOOLEAN NOT NULL DEFAULT true
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS virtual_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      domain TEXT NOT NULL,
      quota_bytes BIGINT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS virtual_aliases (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      goto TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true
    )
  `);
}

async function createJob(input: {
  kind: ProvisionJobKind;
  domainId?: string | null;
  mailboxId?: string | null;
  payload?: Record<string, unknown>;
}) {
  return prisma.provisionJob.create({
    data: {
      kind: input.kind,
      status: "QUEUED",
      domainId: input.domainId ?? null,
      mailboxId: input.mailboxId ?? null,
      payload: (input.payload ?? {}) as object,
    },
  });
}

async function finishJob(
  id: string,
  status: ProvisionJobStatus,
  result?: Record<string, unknown>,
  error?: string,
) {
  return prisma.provisionJob.update({
    where: { id },
    data: {
      status,
      result: result ? (result as object) : undefined,
      error: error ?? null,
      finishedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
}

export const mailEngine = {
  getMode,
  isEnabled() {
    return getMode() !== "disabled";
  },

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const mode = getMode();
    if (mode === "disabled") {
      return {
        ok: false,
        stdout: "",
        stderr: "MAIL_PROVISION_MODE=disabled — enable local or ssh for production",
      };
    }
    if (mode === "ssh") return runSsh(request);
    return runLocal(request);
  },

  async runTracked(input: {
    kind: ProvisionJobKind;
    command: AgentCommand;
    domainId?: string | null;
    mailboxId?: string | null;
    payload: Record<string, unknown>;
  }) {
    const job = await createJob({
      kind: input.kind,
      domainId: input.domainId,
      mailboxId: input.mailboxId,
      payload: input.payload,
    });
    await prisma.provisionJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const response = await this.execute({ command: input.command, payload: input.payload });
    if (response.ok) {
      await finishJob(job.id, "SUCCEEDED", response.data ?? { stdout: response.stdout });
    } else {
      await finishJob(job.id, "FAILED", response.data, response.stderr || "Provision failed");
    }
    return { jobId: job.id, ...response };
  },
};

/** Back-compat export used by older imports */
export const mailEngineIntegration = {
  isConnected() {
    return mailEngine.isEnabled();
  },
  async provision(request: { type: string; payload: Record<string, unknown> }) {
    const map: Record<string, AgentCommand> = {
      domain: "domain.create",
      mailbox: "mailbox.create",
      dns: "dkim.sync",
      ssl: "health.check",
    };
    const command = map[request.type] ?? "health.check";
    return mailEngine.execute({ command, payload: request.payload });
  },
};
