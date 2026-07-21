import { ok, fail, parseJson } from "@/lib/api/response";
import { settingsService } from "@/services/admin";

export async function GET() {
  try {
    return ok(settingsService.get());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Settings failed", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await parseJson(request);
    return ok(settingsService.update(body), undefined, "Settings updated");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Settings update failed", 400);
  }
}
