import { ok, fail, parseJson } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { profileService } from "@/services/auth/profile";

export async function GET() {
  try {
    const session = await requireAdminActor();
    return ok(await profileService.get(session.sub));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile failed";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminActor();
    const body = await parseJson(request);
    return ok(await profileService.update(session.sub, body), undefined, "Profile updated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 400);
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}
