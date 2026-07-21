import { hash, compare } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { SystemRole } from "@/types";
import { SESSION_COOKIE } from "@/lib/auth/permissions";

const SESSION_TTL_HOURS = 12;

function secretKey() {
  const secret = process.env.AUTH_SECRET ?? "phase2b-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string;
  email: string;
  name?: string | null;
  role: SystemRole;
  organizationId?: string | null;
  twoFactorEnabled: boolean;
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
    organizationId: payload.organizationId,
    twoFactorEnabled: payload.twoFactorEnabled,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: (payload.name as string | null | undefined) ?? null,
      role: payload.role as SystemRole,
      organizationId: (payload.organizationId as string | null | undefined) ?? null,
      twoFactorEnabled: Boolean(payload.twoFactorEnabled),
    };
  } catch {
    return null;
  }
}

export async function createDbSession(input: {
  userId: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  return prisma.session.create({
    data: {
      userId: input.userId,
      sessionToken: input.token,
      expires,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function destroyDbSession(token: string) {
  await prisma.session.deleteMany({ where: { sessionToken: token } });
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const dbSession = await prisma.session.findUnique({
    where: { sessionToken: token },
  });
  if (!dbSession || dbSession.expires < new Date()) {
    return null;
  }
  return payload;
}

export function sessionCookieOptions(maxAgeSeconds = SESSION_TTL_HOURS * 3600) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
