import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type AuditStatus = "SUCCESS" | "FAILED" | "PARTIAL";

export type WriteAuditInput = {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: AuditStatus;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
};

export async function writeAudit(input: WriteAuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      status: input.status ?? "SUCCESS",
      oldValue: input.oldValue,
      newValue: input.newValue,
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

/** Extract client IP + User-Agent from a Request for audit trails. */
export function requestAuditContext(request: Request | null | undefined): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  if (!request) return { ipAddress: null, userAgent: null };
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");
  return { ipAddress, userAgent };
}
