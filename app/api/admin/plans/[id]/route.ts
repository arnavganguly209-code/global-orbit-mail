import { ok, fail, parseJson } from "@/lib/api/response";
import { requireSuperAdminMutation } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { billingAdminService } from "@/services/billing/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "billing:write");
    const { id } = await ctx.params;
    return ok(await billingAdminService.updatePlan(id, await parseJson(request), actor.sub));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "billing:write");
    const { id } = await ctx.params;
    return ok(await billingAdminService.deletePlan(id, actor.sub));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
