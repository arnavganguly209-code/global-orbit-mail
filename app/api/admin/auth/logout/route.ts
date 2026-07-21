import { cookies } from "next/headers";
import { ok, fail } from "@/lib/api/response";
import { destroyDbSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/permissions";
import { getRequestActor } from "@/lib/api/actor";
import { writeAudit } from "@/lib/audit";

export async function POST() {
  try {
    const actor = await getRequestActor();
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
      await destroyDbSession(token);
      jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    }
    if (actor) {
      await writeAudit({
        actorId: actor.sub,
        action: "auth.logout",
        resource: "session",
        resourceId: actor.sub,
      });
    }
    return ok({ loggedOut: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Logout failed", 400);
  }
}
