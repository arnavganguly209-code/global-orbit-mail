import { cookies } from "next/headers";
import { ok, fail, parseJson } from "@/lib/api/response";
import { requireCustomerMutation } from "@/lib/api/actor";
import { profileService } from "@/services/auth/profile";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { CURRENT_PASSWORD_INCORRECT } from "@/lib/auth/password-policy";

export async function POST(request: Request) {
  try {
    const session = await requireCustomerMutation(request);
    const body = await parseJson(request);
    const jar = await cookies();
    const keepSessionToken = jar.get(SESSION_COOKIE)?.value ?? null;
    return ok(
      await profileService.changePassword(session.sub, body, { keepSessionToken }),
      undefined,
      "Password changed",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password change failed";
    const status =
      message === "Unauthorized" || message === "Forbidden"
        ? 401
        : message === CURRENT_PASSWORD_INCORRECT
          ? 403
          : 400;
    return fail(message, status);
  }
}
