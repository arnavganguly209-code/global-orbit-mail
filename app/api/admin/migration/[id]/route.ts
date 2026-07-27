import { ok, fail, parseJson } from "@/lib/api/response";
import { requireSuperAdminMutation, requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { migrationService } from "@/services/migration";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "settings:read");
    const { id } = await ctx.params;
    return ok(await migrationService.get(id));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "settings:write");
    const { id } = await ctx.params;
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "cancel") {
      return ok(await migrationService.cancel(id, actor.sub));
    }
    return ok(await migrationService.run(id, await parseJson(request), actor.sub));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
