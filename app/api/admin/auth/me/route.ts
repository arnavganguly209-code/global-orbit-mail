import { cookies } from "next/headers";
import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { profileService } from "@/services/auth/profile";
import { createCsrfToken, csrfCookieOptions, CSRF_COOKIE } from "@/lib/auth/csrf";
import { SESSION_TTL_HOURS } from "@/lib/auth/constants";

export async function GET() {
  try {
    const session = await requireAdminActor();
    const jar = await cookies();
    if (!jar.get(CSRF_COOKIE)?.value) {
      jar.set(
        CSRF_COOKIE,
        createCsrfToken(),
        csrfCookieOptions(SESSION_TTL_HOURS * 3600),
      );
    }
    return ok({ user: await profileService.get(session.sub) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session error";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 500);
  }
}
