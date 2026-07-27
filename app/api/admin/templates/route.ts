import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { templateService } from "@/services/templates";

export async function GET() {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "settings:read");
    await templateService.ensureDefaults();
    return ok(await templateService.list());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "settings:write");
    return created(await templateService.create(await parseJson(request), actor.sub));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
