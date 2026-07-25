import { ok, fail } from "@/lib/api/response";
import { requireAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { prisma } from "@/lib/db";
import {
  doveadmAuthTest,
  isMysqlMailAuthConfigured,
  upsertMysqlVirtualUser,
} from "@/services/provisioning/mysql-mail-auth";
import { normalizeSha512Crypt } from "@/lib/mail/sha512-crypt";
import { existsSync, readFileSync } from "node:fs";
import { assertApiRateLimit } from "@/lib/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/mailboxes/[id]/diagnose-auth
 * Read-only diagnosis of Orbit → MariaDB → Dovecot path.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const actor = await requireAdminActor();
    await assertApiRateLimit(`diagnose-auth:${actor.sub}`, 30, 60_000);
    const { id } = await params;

    const mailbox = await prisma.mailbox.findFirst({
      where: { id },
      include: { domain: true },
    });
    if (!mailbox) return fail("Mailbox not found", 404);

    const email = `${mailbox.localPart}@${mailbox.domain.name}`.toLowerCase();
    const hash = normalizeSha512Crypt(mailbox.mailPasswordHash);
    const dovecotConf =
      process.env.DOVECOT_SQL_CONF?.trim() ||
      (existsSync("/etc/dovecot/dovecot-sql.conf.ext")
        ? "/etc/dovecot/dovecot-sql.conf.ext"
        : existsSync("/etc/dovecot/conf.d/dovecot-sql.conf.ext")
          ? "/etc/dovecot/conf.d/dovecot-sql.conf.ext"
          : null);

    let dovecotSnippet: Record<string, string> | null = null;
    if (dovecotConf) {
      try {
        const text = readFileSync(dovecotConf, "utf8");
        const pick = (key: string) => {
          const line = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .find((l) => l.startsWith(key));
          if (!line) return "";
          return line.replace(/password=\S+/gi, "password=***");
        };
        dovecotSnippet = {
          driver: pick("driver"),
          connect: pick("connect"),
          default_pass_scheme: pick("default_pass_scheme"),
          password_query: pick("password_query"),
        };
      } catch {
        dovecotSnippet = null;
      }
    }

    const jobs = await prisma.provisionJob.findMany({
      where: { mailboxId: id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        kind: true,
        status: true,
        error: true,
        result: true,
        createdAt: true,
        finishedAt: true,
      },
    });

    const mysqlConfigured = isMysqlMailAuthConfigured();
    let mysqlProbe: { ok: boolean; error?: string; note?: string } = {
      ok: false,
      note: "not probed",
    };

    if (mysqlConfigured && hash) {
      const result = await upsertMysqlVirtualUser({
        email,
        passwordHash: hash,
        domain: mailbox.domain.name.toLowerCase(),
      });
      mysqlProbe = {
        ok: result.ok,
        error: result.error,
        note: result.ok
          ? `row present in ${result.database ?? "mailserver"}.virtual_users`
          : "MariaDB upsert failed",
      };
      console.info("[mail-auth:diagnose]", {
        email,
        mysqlConfigured,
        mysqlOk: result.ok,
        hashPrefix: hash.slice(0, 8),
        error: result.error ?? null,
      });
    } else {
      console.warn("[mail-auth:diagnose]", {
        email,
        mysqlConfigured,
        hasSha512Hash: Boolean(hash),
        mailPasswordHashPrefix: mailbox.mailPasswordHash?.slice(0, 12) ?? null,
      });
    }

    return ok({
      email,
      mailboxStatus: mailbox.status,
      deletedAt: mailbox.deletedAt,
      provisionedAt: mailbox.provisionedAt,
      lastLoginAt: mailbox.lastLoginAt,
      mailPasswordScheme: hash
        ? "SHA512-CRYPT"
        : mailbox.mailPasswordHash?.startsWith("$2")
          ? "bcrypt/BLF-CRYPT (INVALID for production Dovecot)"
          : mailbox.mailPasswordHash
            ? "unknown"
            : "missing",
      mailPasswordHashPrefix:
        hash?.slice(0, 12) ?? mailbox.mailPasswordHash?.slice(0, 12) ?? null,
      provisionMode: process.env.MAIL_PROVISION_MODE ?? "local",
      mailAgentScript: process.env.MAIL_AGENT_SCRIPT ?? "/opt/global-orbit/bin/mail-agent.sh",
      agentScriptExists: existsSync(
        process.env.MAIL_AGENT_SCRIPT ?? "/opt/global-orbit/bin/mail-agent.sh",
      ),
      mysqlConfigured,
      mysqlProbe,
      dovecotConfPath: dovecotConf,
      dovecotSnippet,
      recentProvisionJobs: jobs,
      expectedDovecotQuery: "SELECT email,password FROM virtual_users WHERE email='%u'",
      expectedScheme: "SHA512-CRYPT ($6$…)",
      nextStep: !mysqlConfigured
        ? "Set MAIL_MYSQL_* or ensure dovecot-sql.conf.ext is readable, then POST verify-auth"
        : !hash
          ? "mailPasswordHash is not SHA512-CRYPT — POST verify-auth with plaintext password"
          : !mysqlProbe.ok
            ? "Fix MariaDB credentials / virtual_users, then POST verify-auth"
            : "POST verify-auth with password to run doveadm auth test",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Diagnose failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden") || message === "Invalid CSRF token"
          ? 403
          : 400;
    return fail(message, status);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireSuperAdminMutation(request);
    await assertApiRateLimit(`diagnose-auth-post:${actor.sub}`, 10, 60_000);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { password?: string };
    const password = String(body.password ?? "");
    if (!password) return fail("password required for doveadm auth test", 400);

    const mailbox = await prisma.mailbox.findFirst({
      where: { id, deletedAt: null },
      include: { domain: true },
    });
    if (!mailbox) return fail("Mailbox not found", 404);
    const email = `${mailbox.localPart}@${mailbox.domain.name}`.toLowerCase();
    const auth = await doveadmAuthTest(email, password);
    console.info("[mail-auth:diagnose:doveadm]", {
      email,
      ok: auth.ok,
      output: auth.output.slice(0, 200),
    });
    return ok(
      { email, authTest: auth.ok, authOutput: auth.output },
      undefined,
      auth.ok ? "passdb: user authenticated" : "passdb: auth failed",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Diagnose failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
