import { ok, fail, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { assertApiRateLimit } from "@/lib/api/rate-limit";
import { requestAuditContext, writeAudit } from "@/lib/audit";
import { mailServerMonitorService } from "@/services/monitoring/mail-server-monitor";
import { mailEngine } from "@/services/provisioning/mail-engine";
import { prisma } from "@/lib/db";
import { normalizeSha512Crypt } from "@/lib/mail/sha512-crypt";
import { z } from "zod";

export async function GET() {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "monitoring:read");
    return ok(await mailServerMonitorService.getSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mail monitor failed";
    return fail(message, message === "Unauthorized" ? 401 : 500);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("flush-queue") }),
  z.object({ action: z.literal("resync-auth") }),
  z.object({ action: z.literal("repair-mailbox"), email: z.string().email() }),
]);

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    await assertApiRateLimit(`mail-monitor:${actor.sub}`, 15, 60_000);
    const body = actionSchema.parse(await parseJson(request));
    const ctx = requestAuditContext(request);

    if (body.action === "flush-queue") {
      const result = await mailServerMonitorService.flushQueue();
      await writeAudit({
        actorId: actor.sub,
        action: "mail_monitor.flush_queue",
        resource: "mail_server",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        status: result.ok ? "SUCCESS" : "FAILED",
        newValue: result,
      });
      if (!result.ok) return fail(result.detail, 502);
      return ok(result, undefined, result.detail);
    }

    if (body.action === "resync-auth") {
      const result = await mailEngine.resyncAllMailboxAuth();
      await writeAudit({
        actorId: actor.sub,
        action: "mail_monitor.resync_auth",
        resource: "mail_server",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        status: result.failed === 0 ? "SUCCESS" : "PARTIAL",
        newValue: result as unknown as object,
      });
      return ok(result, undefined, `Synced ${result.synced} mailbox(es)`);
    }

    const email = body.email.toLowerCase().trim();
    const mailbox = await prisma.mailbox.findFirst({
      where: { deletedAt: null, localPart: email.split("@")[0], domain: { name: email.split("@")[1] } },
      include: { domain: { select: { name: true } }, quota: true },
    });
    if (!mailbox) return fail("Mailbox not found in Orbit", 404);
    const hash = normalizeSha512Crypt(mailbox.mailPasswordHash);
    if (!hash) return fail("Mailbox hash is not SHA512-CRYPT — reset password first", 400);

    const repair = await mailEngine.syncSqlAuth(
      {
        command: "mailbox.password",
        payload: {
          email,
          mailPasswordHash: hash,
          quotaBytes: (mailbox.quota?.quotaMb ?? 2048) * 1024 * 1024,
        },
      },
      "mail-monitor-repair",
    );
    await writeAudit({
      actorId: actor.sub,
      action: "mail_monitor.repair_mailbox",
      resource: "mailbox",
      resourceId: mailbox.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      status: repair.ok ? "SUCCESS" : "FAILED",
      newValue: { email, ok: repair.ok, stderr: repair.stderr?.slice(0, 500) },
    });
    if (!repair.ok) return fail(repair.stderr || "Mailbox auth repair failed", 502);
    return ok({ email, repaired: true }, undefined, `Re-synced auth for ${email}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden") || message === "Invalid CSRF token"
          ? 403
          : message.includes("Too many")
            ? 429
            : 400;
    return fail(message, status);
  }
}
