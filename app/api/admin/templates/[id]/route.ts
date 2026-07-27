import { ok, fail, parseJson } from "@/lib/api/response";
import { requireSuperAdminMutation, requireAdminActor } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { templateService } from "@/services/templates";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "settings:write");
    const { id } = await ctx.params;
    return ok(await templateService.update(id, await parseJson(request), actor.sub));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "settings:write");
    const { id } = await ctx.params;
    return ok(await templateService.remove(id, actor.sub));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    await requireAdminActor();
    const { id } = await ctx.params;
    const body = (await parseJson(request)) as { key?: string; vars?: Record<string, string> };
    const tpl = await templateService.list().then((rows) => rows.find((r) => r.id === id));
    if (!tpl) return fail("Template not found", 404);
    return ok(templateService.render(tpl, body.vars ?? {}));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
