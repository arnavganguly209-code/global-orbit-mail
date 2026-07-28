import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { prisma } from "@/lib/db";
import { hashSha512Crypt, isSha512Crypt, normalizeSha512Crypt } from "@/lib/mail/sha512-crypt";
import { applyPlatformLimitsLocal } from "@/services/provisioning/apply-platform-limits";
import {
  activateMysqlVirtualUser,
  deactivateMysqlVirtualDomain,
  deactivateMysqlVirtualUser,
  isMysqlMailAuthConfigured,
  provisionDovecotAuth,
  upsertMysqlQuota,
  upsertMysqlVirtualAlias,
  upsertMysqlVirtualDomain,
  upsertMysqlVirtualUser,
} from "@/services/provisioning/mysql-mail-auth";
import { ensureLocalMaildir } from "@/services/provisioning/maildir";
import type { ProvisionJobKind, ProvisionJobStatus } from "@prisma/client";

const execFileAsync = promisify(execFile);

export type ProvisionMode = "local" | "ssh" | "disabled";

export type AgentCommand =
  | "domain.create"
  | "domain.delete"
  | "mailbox.create"
  | "mailbox.delete"
  | "mailbox.restore"
  | "mailbox.suspend"
  | "mailbox.unsuspend"
  | "mailbox.password"
  | "mailbox.quota"
  | "alias.sync"
  | "forwarder.sync"
  | "vacation.sync"
  | "dkim.sync"
  | "platform.ensure"
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
  "mailbox.restore",
  "mailbox.suspend",
  "mailbox.unsuspend",
  "mailbox.password",
  "mailbox.quota",
  "alias.sync",
  "forwarder.sync",
]);

/** Agent-only commands: failure must surface (no SQL soft-success). */
const AGENT_CRITICAL = new Set<AgentCommand>(["dkim.sync", "platform.ensure"]);

function getMode(): ProvisionMode {
  const mode = (process.env.MAIL_PROVISION_MODE ?? "local").toLowerCase();
  if (mode === "ssh" || mode === "local" || mode === "disabled") return mode;
  return "local";
}

function agentScriptPath(): string {
  const fromEnv = process.env.MAIL_AGENT_SCRIPT?.trim();
  if (fromEnv) return fromEnv;
  const candidates = [
    "/opt/global-orbit/bin/mail-agent.sh",
    join(process.cwd(), "deploy", "vps", "mail-agent.sh"),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return candidates[0]!;
}

/** Absolute path to attachment-limits script (repo or installed copy). */
function attachmentLimitsScriptPath(): string {
  const fromEnv = process.env.ORBIT_ATTACHMENT_LIMITS_SCRIPT?.trim();
  if (fromEnv) return fromEnv;
  const candidates = [
    "/opt/global-orbit/bin/apply-attachment-limits-inline.sh",
    join(process.cwd(), "deploy", "vps", "apply-attachment-limits-inline.sh"),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return candidates[1]!;
}

/**
 * Raise PHP/Nginx/Postfix/Roundcube attachment limits on the local mail host.
 * Used when mail-agent is outdated or platform.ensure is unavailable.
 */
async function runAttachmentLimitsInline(): Promise<AgentResponse> {
  // Prefer Node-native apply (no dependency on bash script being pre-installed).
  const native = await applyPlatformLimitsLocal();
  if (native.ok) {
    return {
      ok: true,
      stdout: native.steps.join("\n"),
      stderr: "",
      data: { platformEnsured: true, via: "apply-platform-limits.ts", steps: native.steps },
    };
  }

  const script = attachmentLimitsScriptPath();
  if (!existsSync(script)) {
    return {
      ok: false,
      stdout: native.steps.join("\n"),
      stderr: native.error || `Missing ${script}`,
      data: { via: "apply-platform-limits.ts", steps: native.steps },
    };
  }
  try {
    const { stdout, stderr } = await execFileAsync("bash", [script], {
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env },
    });
    return {
      ok: true,
      stdout: `${native.steps.join("\n")}\n${stdout}\n${stderr}`.trim(),
      stderr: "",
      data: { platformEnsured: true, via: "apply-attachment-limits-inline.sh" },
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string; code?: string };
    return {
      ok: false,
      stdout: err.stdout ?? native.steps.join("\n"),
      stderr:
        [native.error, err.stderr ?? err.message ?? `Failed running ${script}`]
          .filter(Boolean)
          .join(" | "),
      data: { via: "apply-attachment-limits-inline.sh", code: err.code },
    };
  }
}

async function runPlatformEnsure(): Promise<AgentResponse> {
  const mode = getMode();

  if (mode === "disabled") {
    return { ok: false, stdout: "", stderr: "MAIL_PROVISION_MODE=disabled" };
  }

  if (mode === "local") {
    // Always run Node-native limits first so missing mail-agent cannot block attachments.
    const native = await runAttachmentLimitsInline();
    const viaAgent = await runLocal({ command: "platform.ensure", payload: {} });
    if (native.ok || viaAgent.ok) {
      return {
        ok: true,
        stdout: [native.stdout, viaAgent.stdout].filter(Boolean).join("\n"),
        stderr: "",
        data: {
          platformEnsured: true,
          via: native.ok ? (native.data?.via ?? "native") : "agent",
          ...(native.data ?? {}),
          ...(viaAgent.data ?? {}),
          agentOk: viaAgent.ok,
        },
      };
    }
    return {
      ok: false,
      stdout: [native.stdout, viaAgent.stdout].filter(Boolean).join("\n"),
      stderr: [native.stderr, viaAgent.stderr].filter(Boolean).join(" | "),
    };
  }

  // ssh mode
  const viaAgent = await runSsh({ command: "platform.ensure", payload: {} });
  if (viaAgent.ok) return viaAgent;
  return viaAgent;
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

function parseAgentOutput(stdout: string, stderr: string): AgentResponse {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { ok: false, stdout, stderr: stderr || "Empty agent response" };
  }

  // Agent may print warnings before the JSON result — prefer the last JSON object line.
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let jsonCandidate = trimmed;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (line.startsWith("{") && line.endsWith("}")) {
      jsonCandidate = line;
      break;
    }
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as {
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
 * @deprecated Postgres virtual_* is NOT used by production Dovecot.
 * Dovecot authenticates against MySQL `mailserver.virtual_users`.
 * Kept as a no-op so older callers/scripts do not crash.
 */
export async function ensureVirtualMailTables() {
  return;
}

/**
 * Sync Dovecot credentials into MySQL mailserver.virtual_users (SHA512-CRYPT).
 * Postgres (Prisma) remains the Orbit control plane — not the IMAP passdb.
 */
async function syncSqlAuth(request: AgentRequest, reason: string): Promise<AgentResponse> {
  try {
    switch (request.command) {
      case "domain.create": {
        const domain = String(request.payload.domain ?? "").toLowerCase().trim();
        if (!domain) throw new Error("domain required");
        if (!isMysqlMailAuthConfigured()) {
          return {
            ok: true,
            stdout: "mysql:domain.create:deferred-to-agent",
            stderr: "",
            data: { sqlSynced: false, mysqlSynced: false, mysqlDeferred: true, reason },
          };
        }
        const domainResult = await upsertMysqlVirtualDomain(domain);
        if (!domainResult.ok) throw new Error(domainResult.error ?? "virtual_domains upsert failed");
        return {
          ok: true,
          stdout: "mysql:domain.create",
          stderr: "",
          data: {
            sqlSynced: true,
            mysqlSynced: true,
            reason,
            database: domainResult.database ?? "mailserver",
          },
        };
      }
      case "domain.delete": {
        const domain = String(request.payload.domain ?? "").toLowerCase().trim();
        if (!domain) throw new Error("domain required");
        if (!isMysqlMailAuthConfigured()) {
          return {
            ok: true,
            stdout: "mysql:domain.delete:deferred-to-agent",
            stderr: "",
            data: { sqlSynced: false, mysqlSynced: false, mysqlDeferred: true, reason },
          };
        }
        const del = await deactivateMysqlVirtualDomain(domain);
        if (!del.ok) throw new Error(del.error ?? "virtual_domains delete failed");
        return {
          ok: true,
          stdout: "mysql:domain.delete",
          stderr: "",
          data: { sqlSynced: true, mysqlSynced: true, reason, database: del.database },
        };
      }
      case "alias.sync":
      case "forwarder.sync": {
        const address = String(request.payload.address ?? "").toLowerCase().trim();
        const goto = String(request.payload.goto ?? "").toLowerCase().trim();
        if (!address || !goto) {
          return {
            ok: true,
            stdout: `mysql:${request.command}:noop`,
            stderr: "",
            data: { sqlSynced: true, mysqlSynced: true, reason },
          };
        }
        if (!isMysqlMailAuthConfigured()) {
          return {
            ok: true,
            stdout: `mysql:${request.command}:deferred-to-agent`,
            stderr: "",
            data: { sqlSynced: false, mysqlSynced: false, mysqlDeferred: true, reason },
          };
        }
        const aliasResult = await upsertMysqlVirtualAlias({ address, goto });
        if (!aliasResult.ok) throw new Error(aliasResult.error ?? "virtual_aliases upsert failed");
        return {
          ok: true,
          stdout: `mysql:${request.command}`,
          stderr: "",
          data: {
            sqlSynced: true,
            mysqlSynced: true,
            reason,
            database: aliasResult.database,
          },
        };
      }
      case "mailbox.quota": {
        const email = String(request.payload.email ?? "").toLowerCase().trim();
        const quotaBytes = Number(request.payload.quotaBytes ?? 0);
        if (!email) throw new Error("email required");
        if (!isMysqlMailAuthConfigured()) {
          return {
            ok: false,
            stdout: "",
            stderr: "MySQL mail auth not configured — cannot update quota",
            data: { sqlSynced: false, mysqlSynced: false, mysqlDeferred: false, reason },
          };
        }
        const quotaResult = await upsertMysqlQuota({ email, quotaBytes });
        if (!quotaResult.ok) {
          throw new Error(quotaResult.error ?? "quota update failed");
        }
        return {
          ok: true,
          stdout: `mysql:mailbox.quota`,
          stderr: "",
          data: {
            sqlSynced: true,
            mysqlSynced: true,
            reason,
            quotaBytes,
            database: quotaResult.database,
          },
        };
      }

      case "mailbox.create":
      case "mailbox.restore":
      case "mailbox.password": {
        const email = String(request.payload.email ?? "").toLowerCase().trim();
        const plain = String(request.payload.password ?? "");
        let password =
          normalizeSha512Crypt(String(request.payload.mailPasswordHash ?? "")) ?? "";
        const domain = email.split("@")[1] ?? "";
        const home = vmailHome(email);
        const quotaBytesRaw = Number(request.payload.quotaBytes ?? NaN);
        const quotaBytes =
          Number.isFinite(quotaBytesRaw) && quotaBytesRaw >= 0 ? quotaBytesRaw : null;
        if (!email || !domain) throw new Error("email required");

        if (plain) {
          password = await hashSha512Crypt(plain);
        }
        if (!isSha512Crypt(password)) {
          throw new Error(
            "SHA512-CRYPT hash required for MySQL virtual_users (bcrypt/argon rejected)",
          );
        }

        // Agent may already have written MariaDB; Node sync is best-effort when configured.
        // mysqlDeferred alone must NOT count as mysqlSynced success for mailbox.create.
        if (!isMysqlMailAuthConfigured()) {
          return {
            ok: false,
            stdout: `mysql:${request.command}:not-configured`,
            stderr:
              "MySQL mail auth not configured (MAIL_MYSQL_* or dovecot-sql.conf.ext) — cannot sync virtual_users",
            data: {
              sqlSynced: false,
              mysqlSynced: false,
              mysqlDeferred: false,
              authTest: false,
              reason,
              email,
              home,
              mailPasswordHash: password,
              scheme: "SHA512-CRYPT",
            },
          };
        }

        if (plain) {
          const proved = await provisionDovecotAuth({
            email,
            password: plain,
            passwordHash: password,
            domain,
            quotaBytes,
          });
          if (!proved.ok) {
            throw new Error(proved.error ?? "Dovecot auth provision failed");
          }
          const md = ensureLocalMaildir(email);
          return {
            ok: true,
            stdout: proved.authOutput ?? `mysql:${request.command}:auth-ok`,
            stderr: md.ok ? "" : md.error ?? "",
            data: {
              sqlSynced: true,
              mysqlSynced: true,
              authTest: true,
              authOutput: proved.authOutput,
              maildirOk: md.ok,
              maildirHome: md.home,
              reason,
              email,
              home,
              mailPasswordHash: password,
              scheme: "SHA512-CRYPT",
              database: proved.database ?? "mailserver",
            },
          };
        }

        const mysqlResult = await upsertMysqlVirtualUser({
          email,
          passwordHash: password,
          domain,
          quotaBytes,
        });
        if (!mysqlResult.ok) {
          throw new Error(mysqlResult.error ?? "MySQL virtual_users upsert failed");
        }

        const md = ensureLocalMaildir(email);
        return {
          ok: true,
          stdout: `mysql:${request.command}`,
          stderr: md.ok ? "" : md.error ?? "",
          data: {
            sqlSynced: true,
            mysqlSynced: true,
            authTest: false,
            maildirOk: md.ok,
            maildirHome: md.home,
            reason,
            email,
            home,
            mailPasswordHash: password,
            scheme: "SHA512-CRYPT",
            database: mysqlResult.database ?? "mailserver",
          },
        };
      }
      case "mailbox.delete":
      case "mailbox.suspend": {
        const email = String(request.payload.email ?? "").toLowerCase();
        if (!isMysqlMailAuthConfigured()) {
          return {
            ok: true,
            stdout: `mysql:${request.command}:deferred-to-agent`,
            stderr: "",
            data: { sqlSynced: false, mysqlSynced: false, mysqlDeferred: true },
          };
        }
        const mysqlResult = await deactivateMysqlVirtualUser(email);
        if (!mysqlResult.ok) {
          throw new Error(mysqlResult.error ?? "MySQL deactivate failed");
        }
        return {
          ok: true,
          stdout: `mysql:${request.command}`,
          stderr: "",
          data: { sqlSynced: true, mysqlSynced: true },
        };
      }
      case "mailbox.unsuspend": {
        const email = String(request.payload.email ?? "").toLowerCase();
        const plain = String(request.payload.password ?? "");
        const hash =
          normalizeSha512Crypt(String(request.payload.mailPasswordHash ?? "")) ?? "";
        // Prefer full re-provision when password is available (row may have been deleted).
        if (plain || hash) {
          return syncSqlAuth(
            {
              command: "mailbox.password",
              payload: {
                email,
                password: plain || undefined,
                mailPasswordHash: hash || undefined,
              },
            },
            reason,
          );
        }
        if (!isMysqlMailAuthConfigured()) {
          return {
            ok: true,
            stdout: "mysql:mailbox.unsuspend:deferred-to-agent",
            stderr: "",
            data: { sqlSynced: false, mysqlSynced: false, mysqlDeferred: true },
          };
        }
        const mysqlResult = await activateMysqlVirtualUser(email);
        return {
          ok: true,
          stdout: "mysql:mailbox.unsuspend",
          stderr: "",
          data: { sqlSynced: true, mysqlSynced: mysqlResult.ok },
        };
      }
      default:
        return {
          ok: true,
          stdout: `mysql:${request.command}`,
          stderr: "",
          data: { sqlSynced: true, mysqlSynced: true, reason },
        };
    }
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : "MySQL auth sync failed",
    };
  }
}

function mergeAuthResults(
  request: AgentRequest,
  agentResult: AgentResponse,
  sqlResult: AgentResponse,
): AgentResponse {
  const needsAuthProof =
    request.command === "mailbox.create" ||
    request.command === "mailbox.restore" ||
    request.command === "mailbox.password";

  const authOk =
    Boolean(sqlResult.data?.authTest) || Boolean(agentResult.data?.authTest);
  // Prefer SQL auth success when agent fails — but never treat mysqlDeferred alone as synced.
  const mysqlOk =
    Boolean(sqlResult.data?.mysqlSynced) || Boolean(agentResult.data?.mysqlSynced);

  // Prefer agent success when Node cannot reach MariaDB (agent runs on VPS).
  // Soft-fail: mysqlDeferred=false path must not count as success without mysqlOk.
  const ok = needsAuthProof
    ? Boolean(authOk && mysqlOk)
    : Boolean(mysqlOk || agentResult.ok || (sqlResult.ok && sqlResult.data?.mysqlSynced));

  console.info("[mail-auth:merge]", {
    command: request.command,
    email: request.payload.email ?? null,
    agentOk: agentResult.ok,
    sqlOk: sqlResult.ok,
    mysqlOk,
    authOk,
    ok,
    agentErr: agentResult.ok ? null : agentResult.stderr?.slice(0, 200),
    sqlErr: sqlResult.ok ? null : sqlResult.stderr?.slice(0, 200),
  });

  return {
    ok,
    stdout: [agentResult.stdout, sqlResult.stdout].filter(Boolean).join("\n"),
    stderr: ok
      ? ""
      : [sqlResult.stderr, agentResult.stderr].filter(Boolean).join(" | ") ||
        "Dovecot MariaDB auth provision failed",
    data: {
      ...(agentResult.data ?? {}),
      ...(sqlResult.data ?? {}),
      agentOk: agentResult.ok,
      sqlSynced: mysqlOk,
      mysqlSynced: mysqlOk,
      authTest: authOk,
    },
  };
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
    // Always invoke via bash so missing/broken shebang never causes ENOENT-style failures.
    const { stdout, stderr } = await execFileAsync("bash", [script, request.command], {
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, MAIL_AGENT_PAYLOAD: JSON.stringify(agentPayload) },
      shell: false,
    });
    agentResult = parseAgentOutput(stdout, stderr);
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string; code?: string };
    if (err.stdout || err.stderr) {
      agentResult = parseAgentOutput(
        err.stdout ?? "",
        err.stderr ?? err.message ?? "agent failed",
      );
    } else if (err.code === "ENOENT") {
      // Mailbox auth can still succeed via Node → MariaDB + doveadm when agent is missing.
      agentResult = {
        ok: false,
        stdout: "",
        stderr: `spawn bash/${script} ENOENT`,
      };
    } else {
      agentResult = {
        ok: false,
        stdout: "",
        stderr: err.message ?? "mail agent failed",
      };
    }
  }

  // Auth-critical: MariaDB virtual_users (+ doveadm). Agent success counts.
  if (AUTH_COMMANDS.has(request.command)) {
    const sqlResult = await syncSqlAuth(
      request,
      agentResult.ok ? "post-agent-sync" : "agent-unavailable-or-failed",
    );
    return mergeAuthResults(request, agentResult, sqlResult);
  }

  // DKIM / platform harden: never soft-succeed via SQL stub
  if (AGENT_CRITICAL.has(request.command)) {
    return agentResult;
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
      agentResult.ok ? "post-ssh-sync" : "ssh-failed-mysql-sync",
    );
    return mergeAuthResults(request, agentResult, sqlResult);
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
 * Re-sync every active mailbox into MySQL mailserver.virtual_users (Dovecot passdb).
 * Requires mailPasswordHash already in SHA512-CRYPT form (or plaintext via agent).
 */
export async function resyncAllMailboxAuth(): Promise<{ synced: number; failed: number }> {
  const rows = await prisma.mailbox.findMany({
    where: { deletedAt: null, mailPasswordHash: { not: null } },
    include: { domain: true, quota: true },
  });
  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    const email = `${row.localPart}@${row.domain.name}`.toLowerCase();
    const hash = normalizeSha512Crypt(row.mailPasswordHash);
    if (!hash) {
      failed += 1;
      continue;
    }
    const result = await syncSqlAuth(
      {
        command: "mailbox.password",
        payload: {
          email,
          mailPasswordHash: hash,
          quotaBytes: (row.quota?.quotaMb ?? 2048) * 1024 * 1024,
        },
      },
      "resync",
    );
    if (result.ok && (result.data?.mysqlSynced || result.data?.mysqlDeferred)) synced += 1;
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
  ensurePlatform: runPlatformEnsure,

  async execute(request: AgentRequest): Promise<AgentResponse> {
    if (request.command === "platform.ensure") {
      return runPlatformEnsure();
    }

    const mode = getMode();
    const maxAttempts = AUTH_COMMANDS.has(request.command) ? 2 : 1;
    let last: AgentResponse = { ok: false, stdout: "", stderr: "not run" };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (mode === "disabled") {
        if (AUTH_COMMANDS.has(request.command)) {
          last = await syncSqlAuth(request, "provision-mode-disabled-mysql-only");
        } else {
          last = {
            ok: false,
            stdout: "",
            stderr: "MAIL_PROVISION_MODE=disabled — enable local or ssh for production",
          };
        }
      } else if (mode === "ssh") {
        last = await runSsh(request);
      } else {
        last = await runLocal(request);
      }

      if (last.ok) {
        if (attempt > 1) {
          console.info("[mail-auth:retry]", {
            command: request.command,
            attempt,
            ok: true,
          });
        }
        return { ...last, data: { ...(last.data ?? {}), attempts: attempt } };
      }

      console.warn("[mail-auth:retry]", {
        command: request.command,
        attempt,
        ok: false,
        stderr: last.stderr?.slice(0, 200),
      });
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }

    return { ...last, data: { ...(last.data ?? {}), attempts: maxAttempts } };
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
