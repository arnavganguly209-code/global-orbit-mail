/**
 * Admin profile — read / update / change password (Phase 3A).
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/session";
import { writeActivity, writeAudit } from "@/lib/audit";
import type { SystemRole } from "@/types";

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  image: z
    .string()
    .trim()
    .max(2_000_000)
    .optional()
    .nullable()
    .refine(
      (v) => v == null || v.startsWith("http") || v.startsWith("/") || v.startsWith("data:image/"),
      "Invalid image URL",
    ),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z
    .string()
    .min(12)
    .max(128)
    .refine((p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p), {
      message: "Password must include upper, lower, and a number",
    }),
});

export const profileService = {
  async get(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        role: true,
        organization: true,
      },
    });
    if (!user) throw new Error("User not found");

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: (user.role?.key ?? "MAILBOX_USER") as SystemRole,
      roleName: user.role?.name ?? "User",
      company: user.organization?.name ?? null,
      organizationId: user.organizationId,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      status: user.status,
    };
  },

  async update(userId: string, body: unknown) {
    const input = profileUpdateSchema.parse(body);
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.image !== undefined ? { image: input.image } : {}),
      },
      include: { role: true, organization: true },
    });

    await writeAudit({
      actorId: userId,
      action: "profile.update",
      resource: "user",
      resourceId: userId,
      metadata: { fields: Object.keys(input) },
    });

    await writeActivity({
      actorId: userId,
      organizationId: user.organizationId,
      category: "profile",
      message: "Admin profile updated",
    });

    return this.get(userId);
  },

  async changePassword(userId: string, body: unknown) {
    const input = changePasswordSchema.parse(body);
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user?.passwordHash) throw new Error("User not found");

    const ok = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!ok) throw new Error("Current password is incorrect");

    const passwordHash = await hashPassword(input.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await writeAudit({
      actorId: userId,
      action: "profile.password_change",
      resource: "user",
      resourceId: userId,
    });

    await writeActivity({
      actorId: userId,
      organizationId: user.organizationId,
      category: "security",
      message: "Admin password changed",
      severity: "warning",
    });

    return { changed: true };
  },
};
