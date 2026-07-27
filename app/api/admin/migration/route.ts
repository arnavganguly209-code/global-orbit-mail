import { ok, fail, created, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireSuperAdminMutation } from "@/lib/api/actor";
import { requirePermission } from "@/lib/auth/permissions";
import { migrationService } from "@/services/migration";

export async function GET(request: Request) {
  try {
    const actor = await requireAdminActor();
    requirePermission(actor.role, "settings:read");
    const { searchParams } = new URL(request.url);
    return ok(
      await migrationService.list({
        page: Number(searchParams.get("page") || 1),
        pageSize: Number(searchParams.get("pageSize") || 20),
      }),
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdminMutation(request);
    requirePermission(actor.role, "settings:write");
    return created(await migrationService.create(await parseJson(request), actor.sub));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed", 400);
  }
}
