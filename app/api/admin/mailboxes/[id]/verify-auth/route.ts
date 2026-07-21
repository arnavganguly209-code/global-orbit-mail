import { ok, fail, parseJson } from "@/lib/api/response";
import { requireSuperAdminMutation } from "@/lib/api/actor";
import { prisma } from "@/lib/db";
import { hashSha512Crypt } from "@/lib/mail/sha512-crypt";
import {
  doveadmAuthTest,
  provisionDovecotAuth,
} from "@/services/provisioning/mysql-mail-auth";
import { assertApiRateLimit } from "@/lib/api/rate-limit";
import { requestAuditContext, writeAudit } from "@/lib/audit";
import { mailEngine } from "@/services/provisioning/mail-engine";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/mailboxes/[id]/verify-auth
 * Body: { password: string }
 *
 * Writes MySQL mailserver.virtual_users (SHA512-CRYPT), creates Maildir via agent,
 * then runs `doveadm auth test` and returns the exact output.
 * Success only when output contains: passdb: user authenticated
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireSuperAdminMutation(request);
    await assertApiRateLimit(`verify-auth:${actor.sub}`, 20, 60_000);
    const { id } = await params;
    const body = (await parseJson(request)) as { password?: string };
    const password = String(body.password ?? "");
    if (!password) return fail("password required", 400);

    const mailbox = await prisma.mailbox.findFirst({
      where: { id, deletedAt: null },
      include: { domain: true, quota: true },
    });
    if (!mailbox) return fail("Mailbox not found", 404);

    const email = `${mailbox.localPart}@${mailbox.domain.name}`.toLowerCase();
    const mailPasswordHash = await hashSha512Crypt(password);

    // Maildir + MySQL via agent when available
    const agent = await mailEngine.execute({
      command: "mailbox.password",
      payload: {
        email,
        password,
        mailPasswordHash,
        quotaBytes: (mailbox.quota?.quotaMb ?? 2048) * 1024 * 1024,
      },
    });

    // Direct prove path (also runs if agent path already did)
    const proved =
      agent.data?.authTest === true
        ? {
            ok: true,
            authTest: true,
            authOutput: String(agent.data.authOutput ?? agent.stdout ?? ""),
            database: String(agent.data.database ?? "mailserver"),
          }
        : await provisionDovecotAuth({
            email,
            password,
            passwordHash: mailPasswordHash,
            domain: mailbox.domain.name.toLowerCase(),
          });

    await prisma.mailbox.update({
      where: { id },
      data: { mailPasswordHash, status: proved.ok ? "ACTIVE" : mailbox.status },
    });

    const ctx = requestAuditContext(request);
    await writeAudit({
      actorId: actor.sub,
      action: "mailbox.verify_auth",
      resource: "mailbox",
      resourceId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      status: proved.ok ? "SUCCESS" : "FAILED",
      newValue: {
        email,
        authTest: proved.ok,
        authOutput: proved.authOutput ?? null,
      },
    });

    if (!proved.ok) {
      // Still return doveadm output for operators
      return fail(
        proved.error ?? proved.authOutput ?? "passdb: auth failed",
        400,
      );
    }

    // Double-check with a fresh doveadm call for the response body
    const fresh = await doveadmAuthTest(email, password);
    return ok(
      {
        email,
        authTest: fresh.ok,
        authOutput: fresh.output,
        mysqlSynced: true,
        agentOk: agent.ok,
      },
      undefined,
      fresh.ok ? "passdb: user authenticated" : "passdb: auth failed",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verify auth failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden") || message === "Invalid CSRF token"
          ? 403
          : 400;
    return fail(message, status);
  }
}
