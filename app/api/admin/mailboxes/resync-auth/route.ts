import { ok, fail } from "@/lib/api/response";
import { requireSuperAdminMutation } from "@/lib/api/actor";
import { mailEngine } from "@/services/provisioning/mail-engine";
import { assertApiRateLimit } from "@/lib/api/rate-limit";
import { requestAuditContext, writeAudit } from "@/lib/audit";

/**
 * POST /api/admin/mailboxes/resync-auth
 * Re-sync SHA512-CRYPT mailPasswordHash values into MySQL mailserver.virtual_users.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    await assertApiRateLimit(`resync-auth:${actor.sub}`, 5, 60_000);
    const result = await mailEngine.resyncAllMailboxAuth();
    const ctx = requestAuditContext(request);
    await writeAudit({
      actorId: actor.sub,
      action: "mailbox.resync_auth",
      resource: "mailbox",
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      status: result.failed === 0 ? "SUCCESS" : "PARTIAL",
      newValue: result as unknown as object,
    });
    return ok(
      result,
      undefined,
      `Synced ${result.synced} mailbox(es) to MySQL mailserver.virtual_users` +
        (result.failed ? ` (${result.failed} failed — reset password if hash was not SHA512-CRYPT)` : ""),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resync failed";
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
