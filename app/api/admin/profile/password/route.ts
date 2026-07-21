import { ok, fail, parseJson } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { profileService } from "@/services/auth/profile";

export async function POST(request: Request) {
  try {
    const session = await requireAdminActor();
    const body = await parseJson(request);
    return ok(
      await profileService.changePassword(session.sub, body),
      undefined,
      "Password changed",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password change failed";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 400);
  }
}
