import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { profileService } from "@/services/auth/profile";

export async function GET() {
  try {
    const session = await requireAdminActor();
    return ok({ user: await profileService.get(session.sub) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session error";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 500);
  }
}
