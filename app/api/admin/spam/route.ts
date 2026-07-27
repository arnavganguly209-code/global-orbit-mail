import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { spamAdminService } from "@/services/spam/admin";

export async function GET() {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "monitoring:read");
    return ok(await spamAdminService.getOverview());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
