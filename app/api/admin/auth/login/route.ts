import { cookies } from "next/headers";
import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { userRepository } from "@/repositories";
import {
  createDbSession,
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/permissions";
import { writeAudit } from "@/lib/audit";
import type { SystemRole } from "@/types";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = loginBodySchema.parse(await parseJson(request));
    const user = await userRepository.findByEmail(body.email);
    if (!user || !user.passwordHash) {
      return fail("Invalid email or password", 401);
    }
    if (user.status !== "ACTIVE") {
      return fail("Account is not active", 403);
    }
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return fail("Invalid email or password", 401);
    }

    const role = (user.role?.key ?? "MAILBOX_USER") as SystemRole;
    if (!["SUPER_ADMIN", "SUPPORT_STAFF", "RESELLER"].includes(role)) {
      return fail("Admin access required", 403);
    }

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role,
      organizationId: user.organizationId,
      twoFactorEnabled: user.twoFactorEnabled,
    });

    await createDbSession({
      userId: user.id,
      token,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await writeAudit({
      actorId: user.id,
      action: "auth.login",
      resource: "session",
      resourceId: user.id,
    });

    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookieOptions());

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Login failed", 400);
  }
}
