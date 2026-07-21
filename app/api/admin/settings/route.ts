import { ok, fail, parseJson } from "@/lib/api/response";
import { requireAdminActor, requireAdminMutation } from "@/lib/api/actor";
import { settingsService } from "@/services/admin";

export async function GET() {
  try {
    await requireAdminActor();
    return ok(await settingsService.get());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings failed";
    return fail(message, message === "Unauthorized" ? 401 : 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdminMutation(request);
    const body = await parseJson(request);
    return ok(await settingsService.update(body, actor.sub), undefined, "Settings updated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings update failed";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}
