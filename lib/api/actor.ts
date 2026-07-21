import { getSessionFromCookies, type SessionPayload } from "@/lib/auth/session";

export async function getRequestActor(): Promise<SessionPayload | null> {
  return getSessionFromCookies();
}

export async function requireAdminActor(): Promise<SessionPayload> {
  const session = await getSessionFromCookies();
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "SUPPORT_STAFF" &&
    session.role !== "RESELLER"
  ) {
    throw new Error("Forbidden");
  }
  return session;
}
