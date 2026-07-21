import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

export async function writeActivity(input: {
  actorId?: string | null;
  organizationId?: string | null;
  category: string;
  message: string;
  severity?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.activity.create({
    data: {
      actorId: input.actorId ?? null,
      organizationId: input.organizationId ?? null,
      category: input.category,
      message: input.message,
      severity: input.severity ?? "info",
      metadata: input.metadata,
    },
  });
}
