import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { systemHealthService } from "@/services/system/health";
import { assertApiRateLimit } from "@/lib/api/rate-limit";

/**
 * GET /api/admin/system
 * Live health: Postfix, Dovecot, Rspamd, Redis, Roundcube, Nginx, PHP, DB, CPU/RAM/Disk.
 */
export async function GET(request: Request) {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "monitoring:read");
    await assertApiRateLimit(`system:${actor.sub}`, 60, 60_000);
    const report = await systemHealthService.getReport(actor.sub, { audit: true });
    return ok(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "System health failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden" || message.startsWith("Forbidden:")
          ? 403
          : message.includes("Too many")
            ? 429
            : 400;
    return fail(message, status);
  }
}
