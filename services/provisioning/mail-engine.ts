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

const AUTH_COMMANDS = new Set<AgentCommand>([
  "domain.create",
  "domain.delete",
  "mailbox.create",
  "mailbox.delete",
  "mailbox.suspend",
  "mailbox.unsuspend",
  "mailbox.password",
  "mailbox.quota",
  "alias.sync",
  "forwarder.sync",
]);

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

function vmailHome(email: string): string {
  const base = (process.env.VMAIL_BASE ?? "/var/mail/vhosts").replace(/\/$/, "");
  const [local, domain] = email.split("@");
  if (!local || !domain) return `${base}/unknown`;
  return `${base}/${domain.toLowerCase()}/${local.toLowerCase()}`;
}

/** Hash with live doveadm/openssl when running on the mail host (Linux). */
async function hashPasswordWithSystemTools(plain: string): Promise<string | null> {
  const scheme = (process.env.DOVECOT_PASS_SCHEME ?? "SHA512-CRYPT").trim();
  try {
    const { stdout } = await execFileAsync("doveadm", ["pw", "-s", scheme, "-p", plain], {
      timeout: 15_000,
    });
    const hash = stdout.trim();
    if (hash) return hash;
  } catch {
    // fall through
  }
  try {
    const { stdout } = await execFileAsync("openssl", ["passwd", "-6", plain], {
      timeout: 15_000,
    });
    const hash = stdout.trim();
    if (hash) return hash.startsWith("{") ? hash : `{SHA512-CRYPT}${hash}`;
  } catch {
    // fall through
  }
  return null;
}

function parseAgentOutput(stdout: string, stderr: string): AgentResponse {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { ok: false, stdout, stderr: stderr || "Empty agent response" };
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      ok?: boolean;
      data?: Record<string, unknown>;
      error?: string;
    };
    return {
      ok: Boolean(parsed.ok),
      stdout,
      stderr: parsed.error ?? stderr,
      data: parsed.data,
    };
  } catch {
    const ok = /^OK\b/i.test(trimmed) || trimmed.toLowerCase().includes('"ok":true');
    return { ok, stdout, stderr };
  }
}

/**
 * Durable Postfix/Dovecot SQL maps. Always written on mailbox create/password
 * so Roundcube → Dovecot auth works even if the shell agent is a stub.
 */
export async function ensureVirtualMailTables() {
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
      active BOOLEAN NOT NULL DEFAULT true,
      home TEXT,
      uid INTEGER,
      gid INTEGER
    )
  `);
  // Upgrade older virtual_users rows created without home/uid/gid
  await prisma.$executeRawUnsafe(`ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS home TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS uid INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS gid INTEGER`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS virtual_aliases (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      goto TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true
    )
  `);
}

async function syncSqlAuth(request: AgentRequest, reason: string): Promise<AgentResponse> {
  try {
    await ensureVirtualMailTables();
    const uid = Number(process.env.VMAIL_UID ?? "5000");
    const gid = Number(process.env.VMAIL_GID ?? "5000");

    switch (request.command) {
      case "domain.create": {
        const domain = String(request.payload.domain ?? "").toLowerCase();
        if (!domain) throw new Error("domain required");
        await prisma.$executeRawUnsafe(
          `INSERT INTO virtual_domains (name, active) VALUES ($1, true)
           ON CONFLICT (name) DO UPDATE SET active = true`,
          domain,
        );
        return { ok: true, stdout: "sql:domain.create", stderr: "", data: { sqlSynced: true, reason } };
      }
      case "domain.delete": {
        const domain = String(request.payload.domain ?? "").toLowerCase();
        await prisma.$executeRawUnsafe(
          `UPDATE virtual_domains SET active = false WHERE name = $1`,
          domain,
        );
        await prisma.$executeRawUnsafe(
          `UPDATE virtual_users SET active = false WHERE domain = $1`,
          domain,
        );
        return { ok: true, stdout: "sql:domain.delete", stderr: "", data: { sqlSynced: true } };
      }
      case "mailbox.create":
      case "mailbox.password": {
        const email = String(request.payload.email ?? "").toLowerCase().trim();
        const plain = String(request.payload.password ?? "");
        let password = String(request.payload.mailPasswordHash ?? "").trim();
        const quotaBytes = Number(request.payload.quotaBytes ?? 0);
        const domain = email.split("@")[1] ?? "";
        if (!email || !domain) throw new Error("email required");

        // Prefer a hash generated by live doveadm/openssl when plaintext is available
        if (plain) {
          const systemHash = await hashPasswordWithSystemTools(plain);
          if (systemHash) password = systemHash;
        }
        if (!password) throw new Error("mailPasswordHash or password required for Dovecot auth");

        // Do NOT force {BLF-CRYPT} — production Dovecot often expects SHA512-CRYPT ($6$)
        const home = vmailHome(email);
        await prisma.$executeRawUnsafe(
          `INSERT INTO virtual_domains (name, active) VALUES ($1, true)
           ON CONFLICT (name) DO UPDATE SET active = true`,
          domain,
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO virtual_users (email, password, domain, quota_bytes, active, home, uid, gid)
           VALUES ($1, $2, $3, $4, true, $5, $6, $7)
           ON CONFLICT (email) DO UPDATE SET
             password = EXCLUDED.password,
             quota_bytes = EXCLUDED.quota_bytes,
             active = true,
             home = EXCLUDED.home,
             uid = EXCLUDED.uid,
             gid = EXCLUDED.gid`,
          email,
          password,
          domain,
          quotaBytes,
          home,
          uid,
          gid,
        );
        return {
          ok: true,
          stdout: `sql:${request.command}`,
          stderr: "",
          data: {
            sqlSynced: true,
            reason,
            email,
            home,
            mailPasswordHash: password,
            scheme: password.startsWith("$6$") || password.includes("SHA512")
              ? "SHA512-CRYPT"
              : password.includes("BLF-CRYPT") || password.startsWith("$2")
                ? "BLF-CRYPT"
                : "unknown",
          },
        };
      }
      case "mailbox.delete": {
        const email = String(request.payload.email ?? "").toLowerCase();
        await prisma.$executeRawUnsafe(`UPDATE virtual_users SET active = false WHERE email = $1`, email);
        return { ok: true, stdout: "sql:mailbox.delete", stderr: "", data: { sqlSynced: true } };
      }
      case "mailbox.suspend": {
        const email = String(request.payload.email ?? "").toLowerCase();
        await prisma.$executeRawUnsafe(`UPDATE virtual_users SET active = false WHERE email = $1`, email);
        return { ok: true, stdout: "sql:mailbox.suspend", stderr: "", data: { sqlSynced: true } };
      }
      case "mailbox.unsuspend": {
        const email = String(request.payload.email ?? "").toLowerCase();
        await prisma.$executeRawUnsafe(`UPDATE virtual_users SET active = true WHERE email = $1`, email);
        return { ok: true, stdout: "sql:mailbox.unsuspend", stderr: "", data: { sqlSynced: true } };
      }
      case "mailbox.quota": {
        const email = String(request.payload.email ?? "").toLowerCase();
        const quotaBytes = Number(request.payload.quotaBytes ?? 0);
        await prisma.$executeRawUnsafe(
          `UPDATE virtual_users SET quota_bytes = $2 WHERE email = $1`,
          email,
          quotaBytes,
        );
        return { ok: true, stdout: "sql:mailbox.quota", stderr: "", data: { sqlSynced: true } };
      }
      case "alias.sync":
      case "forwarder.sync": {
        const address = String(request.payload.address ?? "").toLowerCase();
        const goto = String(request.payload.goto ?? "").toLowerCase();
        await prisma.$executeRawUnsafe(
          `INSERT INTO virtual_aliases (address, goto, active) VALUES ($1, $2, true)
           ON CONFLICT (address) DO UPDATE SET goto = EXCLUDED.goto, active = true`,
          address,
          goto,
        );
        return { ok: true, stdout: `sql:${request.command}`, stderr: "", data: { sqlSynced: true } };
      }
      default:
        return { ok: true, stdout: `sql:${request.command}`, stderr: "", data: { sqlSynced: true, reason } };
    }
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : "SQL auth sync failed",
    };
  }
}

async function runLocal(request: AgentRequest): Promise<AgentResponse> {
  const script = agentScriptPath();
  // Flat payload at top-level + nested for agents that expect either shape
  const agentPayload = {
    command: request.command,
    payload: request.payload,
    ...request.payload,
  };
  let agentResult: AgentResponse = {
    ok: false,
    stdout: "",
    stderr: "agent not run",
  };

  try {
    const { stdout, stderr } = await execFileAsync(script, [request.command], {
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, MAIL_AGENT_PAYLOAD: JSON.stringify(agentPayload) },
      shell: false,
    });
    agentResult = parseAgentOutput(stdout, stderr);
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    if (err.stdout || err.stderr) {
      agentResult = parseAgentOutput(
        err.stdout ?? "",
        err.stderr ?? err.message ?? "agent failed",
      );
    } else {
      agentResult = {
        ok: false,
        stdout: "",
        stderr: err.message ?? "mail agent failed",
      };
    }
  }

  // Auth-critical commands ALWAYS sync virtual_* so Dovecot passdb has credentials
  if (AUTH_COMMANDS.has(request.command)) {
    const sqlResult = await syncSqlAuth(
      request,
      agentResult.ok ? "post-agent-sync" : "agent-unavailable-or-failed",
    );
    return {
      ok: sqlResult.ok,
      stdout: [agentResult.stdout, sqlResult.stdout].filter(Boolean).join("\n"),
      stderr: sqlResult.ok
        ? agentResult.ok
          ? ""
          : agentResult.stderr
        : sqlResult.stderr,
      data: {
        ...(agentResult.data ?? {}),
        ...(sqlResult.data ?? {}),
        agentOk: agentResult.ok,
        sqlSynced: sqlResult.ok,
      },
    };
  }

  if (agentResult.ok) return agentResult;
  // Non-auth commands: soft SQL fallback
  return syncSqlAuth(request, agentResult.stderr || "agent failed");
}

async function runSsh(request: AgentRequest): Promise<AgentResponse> {
  const { host, user, keyPath, port } = sshConfig();
  if (!host) {
    // Still sync SQL if DB is shared with mail host
    if (AUTH_COMMANDS.has(request.command)) {
      return syncSqlAuth(request, "ssh-host-missing-sql-only");
    }
    return { ok: false, stdout: "", stderr: "MAIL_PROVISION_SSH_HOST is not configured" };
  }

  const script = agentScriptPath();
  const remote = `${user}@${host}`;
  const agentPayload = {
    command: request.command,
    payload: request.payload,
    ...request.payload,
  };
  const args = [
    "-p",
    String(port),
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
  ];
  if (keyPath) args.push("-i", keyPath);
  args.push(
    remote,
    `MAIL_AGENT_PAYLOAD='${JSON.stringify(agentPayload).replace(/'/g, `'\\''`)}' ${script} ${request.command}`,
  );

  let agentResult: AgentResponse = { ok: false, stdout: "", stderr: "ssh failed" };
  try {
    const { stdout, stderr } = await execFileAsync("ssh", args, {
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    agentResult = parseAgentOutput(stdout, stderr);
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    agentResult = {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "SSH provision failed",
    };
  }

  if (AUTH_COMMANDS.has(request.command)) {
    const sqlResult = await syncSqlAuth(
      request,
      agentResult.ok ? "post-ssh-sync" : "ssh-failed-sql-sync",
    );
    return {
      ok: sqlResult.ok,
      stdout: [agentResult.stdout, sqlResult.stdout].filter(Boolean).join("\n"),
      stderr: sqlResult.ok ? "" : sqlResult.stderr,
      data: {
        ...(agentResult.data ?? {}),
        ...(sqlResult.data ?? {}),
        agentOk: agentResult.ok,
        sqlSynced: sqlResult.ok,
      },
    };
  }

  return agentResult;
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

/**
 * Re-sync every active mailbox into virtual_users (repairs Dovecot passdb).
 */
export async function resyncAllMailboxAuth(): Promise<{ synced: number; failed: number }> {
  await ensureVirtualMailTables();
  const rows = await prisma.mailbox.findMany({
    where: { deletedAt: null, mailPasswordHash: { not: null } },
    include: { domain: true, quota: true },
  });
  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    const email = `${row.localPart}@${row.domain.name}`.toLowerCase();
    const result = await syncSqlAuth(
      {
        command: "mailbox.password",
        payload: {
          email,
          mailPasswordHash: row.mailPasswordHash,
          quotaBytes: (row.quota?.quotaMb ?? 2048) * 1024 * 1024,
        },
      },
      "resync",
    );
    if (result.ok) synced += 1;
    else failed += 1;
  }
  return { synced, failed };
}

export const mailEngine = {
  getMode,
  isEnabled() {
    return getMode() !== "disabled";
  },
  ensureVirtualMailTables,
  resyncAllMailboxAuth,
  syncSqlAuth,

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const mode = getMode();
    if (mode === "disabled") {
      // Still sync SQL auth so Roundcube can work when agent is off but DB is shared
      if (AUTH_COMMANDS.has(request.command)) {
        return syncSqlAuth(request, "provision-mode-disabled-sql-only");
      }
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
