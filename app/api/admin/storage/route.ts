import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { storageService } from "@/services/storage";
import { storageQuerySchema } from "@/lib/validations/admin";
import { assertApiRateLimit } from "@/lib/api/rate-limit";

/**
 * GET /api/admin/storage
 * Quota / usage / percentage across mailboxes (optional agent sync).
 */
export async function GET(request: Request) {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "mailbox:read");
    await assertApiRateLimit(`storage:${actor.sub}`, 30, 60_000);

    const { searchParams } = new URL(request.url);
    const parsed = storageQuerySchema.parse({
      organizationId: searchParams.get("organizationId") ?? undefined,
      mailboxId: searchParams.get("mailboxId") ?? undefined,
      sync: searchParams.get("sync") ?? undefined,
    });

    const report = await storageService.getReport({
      organizationId: parsed.organizationId,
      mailboxId: parsed.mailboxId,
      syncFromAgent: parsed.sync ?? false,
      actorId: actor.sub,
    });
    return ok(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage report failed";
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
