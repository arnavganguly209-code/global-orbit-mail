import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { collectMailHealth } from "@/services/provisioning/mail-health";

export async function GET() {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "monitoring:read");
    return ok(await collectMailHealth());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mail health failed";
    return fail(message, message === "Unauthorized" ? 401 : 500);
  }
}
