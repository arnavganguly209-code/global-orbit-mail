import { cookies } from "next/headers";
import { ok, fail } from "@/lib/api/response";
import { requireAdminActor } from "@/lib/api/actor";
import { profileService } from "@/services/auth/profile";
import { ensureCsrfCookie } from "@/lib/auth/csrf";
import { SESSION_TTL_HOURS } from "@/lib/auth/constants";

export async function GET() {
  try {
    const session = await requireAdminActor();
    // Touch cookies() so Next attaches any CSRF Set-Cookie on this response.
    await cookies();
    const csrfToken = await ensureCsrfCookie(SESSION_TTL_HOURS * 3600);
    const user = await profileService.get(session.sub);
    return ok({
      user,
      csrfToken,
      role: session.role,
      organizationId: session.organizationId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session error";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 500);
  }
}
