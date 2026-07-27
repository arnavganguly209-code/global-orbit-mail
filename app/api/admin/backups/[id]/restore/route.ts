import { ok, fail } from "@/lib/api/response";
import { requireSuperAdminMutation } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { backupService } from "@/services/backup";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "settings:write");
    const { id } = await ctx.params;
    const result = await backupService.restore(id, actor.sub);
    return ok(result, undefined, "Backup restored");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Restore failed", 400);
  }
}
