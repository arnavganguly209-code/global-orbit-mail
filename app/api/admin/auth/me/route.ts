import { ok, fail } from "@/lib/api/response";
import { getRequestActor } from "@/lib/api/actor";

export async function GET() {
  try {
    const session = await getRequestActor();
    if (!session) return fail("Unauthorized", 401);
    return ok({
      user: {
        id: session.sub,
        email: session.email,
        name: session.name,
        role: session.role,
        organizationId: session.organizationId,
        twoFactorEnabled: session.twoFactorEnabled,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Session error", 500);
  }
}
