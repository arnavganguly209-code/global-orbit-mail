import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { backupService } from "@/services/backup";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "settings:read");
    const { id } = await ctx.params;
    return ok(await backupService.get(id));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
