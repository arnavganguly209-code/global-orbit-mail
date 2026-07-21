import { cookies } from "next/headers";
import { ok, fail } from "@/lib/api/response";
import { destroyDbSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { CSRF_COOKIE } from "@/lib/auth/csrf";
import { getRequestActor } from "@/lib/api/actor";
import { assertCsrf } from "@/lib/auth/csrf";
import { writeActivity, writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    await assertCsrf(request);
    const actor = await getRequestActor();
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
      await destroyDbSession(token);
      jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
      jar.set(CSRF_COOKIE, "", { path: "/", maxAge: 0 });
    }
    if (actor) {
      await writeAudit({
        actorId: actor.sub,
        action: "auth.logout",
        resource: "session",
        resourceId: actor.sub,
      });
      await writeActivity({
        actorId: actor.sub,
        organizationId: actor.organizationId,
        category: "auth",
        message: `${actor.email} signed out of webmail`,
      });
    }
    return ok({ loggedOut: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logout failed";
    return fail(message, message === "Invalid CSRF token" ? 403 : 400);
  }
}
