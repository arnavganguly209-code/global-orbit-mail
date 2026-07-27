import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { analyticsService } from "@/services/analytics";

export async function GET() {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "analytics:read");
    return ok(await analyticsService.getOverview());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analytics failed";
    const status = message.startsWith("Forbidden") ? 403 : message === "Unauthorized" ? 401 : 400;
    return fail(message, status);
  }
}
