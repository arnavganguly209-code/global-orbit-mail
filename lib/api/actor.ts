import { getSessionFromCookies, type SessionPayload } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/auth/csrf";
import { isAdminRole, isSuperAdmin } from "@/lib/auth/permissions";

export async function getRequestActor(): Promise<SessionPayload | null> {
  return getSessionFromCookies();
}

export async function requireAdminActor(): Promise<SessionPayload> {
  const session = await getSessionFromCookies();
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!isAdminRole(session.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

/** Provisioning, DNS verify, server settings, security — Super Admin only. */
export async function requireSuperAdminActor(): Promise<SessionPayload> {
  const session = await requireAdminActor();
  if (!isSuperAdmin(session.role)) {
    throw new Error("Forbidden: Super Admin required");
  }
  return session;
}

export async function requireCustomerActor(): Promise<SessionPayload> {
  const session = await getSessionFromCookies();
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (session.role !== "CUSTOMER" && session.role !== "RESELLER") {
    throw new Error("Forbidden");
  }
  if (!session.organizationId) {
    throw new Error("No organization on account");
  }
  return session;
}

/** Session + CSRF for POST/PUT/PATCH/DELETE admin mutations. */
export async function requireAdminMutation(request: Request): Promise<SessionPayload> {
  const actor = await requireAdminActor();
  await assertCsrf(request);
  return actor;
}

/** Super Admin + CSRF for destructive / provision / verify / settings mutations. */
export async function requireSuperAdminMutation(request: Request): Promise<SessionPayload> {
  const actor = await requireSuperAdminActor();
  await assertCsrf(request);
  return actor;
}

/** Session + CSRF for POST/PUT/PATCH/DELETE customer mutations. */
export async function requireCustomerMutation(request: Request): Promise<SessionPayload> {
  const actor = await requireCustomerActor();
  await assertCsrf(request);
  return actor;
}
