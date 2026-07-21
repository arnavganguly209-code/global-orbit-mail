import { ok, fail, parseJson } from "@/lib/api/response";
import { requireSuperAdminMutation } from "@/lib/api/actor";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  action: z.enum([
    "activate",
    "suspend",
    "assign_plan",
    "extend",
    "set_storage",
  ]),
  planKey: z.enum(["starter", "business", "enterprise"]).optional(),
  interval: z.enum(["MONTHLY", "YEARLY", "TWO_YEAR"]).optional(),
  extendMonths: z.coerce.number().int().min(1).max(36).optional(),
  storageGb: z.coerce.number().int().min(1).max(10240).optional(),
});

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (message.startsWith("Forbidden") || message === "Invalid CSRF token") return 403;
  if (message === "Customer not found") return 404;
  return 400;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requireSuperAdminMutation(request);
    const { id } = await params;
    const body = patchSchema.parse(await parseJson(request));

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null, role: { key: "CUSTOMER" } },
      include: { organization: true },
    });
    if (!user || !user.organizationId) throw new Error("Customer not found");

    if (body.action === "activate") {
      await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { status: "ACTIVE" } }),
        prisma.organization.update({
          where: { id: user.organizationId },
          data: { status: "ACTIVE" },
        }),
      ]);
      const sub = await prisma.subscription.findFirst({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
      });
      if (sub) {
        const end = new Date();
        if (sub.interval === "MONTHLY") end.setMonth(end.getMonth() + 1);
        else if (sub.interval === "YEARLY") end.setFullYear(end.getFullYear() + 1);
        else end.setFullYear(end.getFullYear() + 2);
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: end,
          },
        });
      }
    }

    if (body.action === "suspend") {
      await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { status: "SUSPENDED" } }),
        prisma.organization.update({
          where: { id: user.organizationId },
          data: { status: "SUSPENDED" },
        }),
        prisma.subscription.updateMany({
          where: { organizationId: user.organizationId, status: "ACTIVE" },
          data: { status: "PAST_DUE" },
        }),
      ]);
    }

    if (body.action === "assign_plan") {
      if (!body.planKey || !body.interval) throw new Error("planKey and interval are required");
      const plan = await prisma.plan.findUnique({ where: { key: body.planKey } });
      if (!plan) throw new Error("Plan not found");
      const sub = await prisma.subscription.findFirst({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
      });
      const end = new Date();
      if (body.interval === "MONTHLY") end.setMonth(end.getMonth() + 1);
      else if (body.interval === "YEARLY") end.setFullYear(end.getFullYear() + 1);
      else end.setFullYear(end.getFullYear() + 2);

      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            planId: plan.id,
            interval: body.interval,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: end,
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            organizationId: user.organizationId,
            ownerId: user.id,
            planId: plan.id,
            interval: body.interval,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: end,
          },
        });
      }
      await prisma.organization.update({
        where: { id: user.organizationId },
        data: { status: "ACTIVE" },
      });
      await prisma.user.update({ where: { id }, data: { status: "ACTIVE" } });
    }

    if (body.action === "extend") {
      const months = body.extendMonths ?? 1;
      const sub = await prisma.subscription.findFirst({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
      });
      if (!sub) throw new Error("No subscription to extend");
      const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
        ? sub.currentPeriodEnd
        : new Date();
      const end = new Date(base);
      end.setMonth(end.getMonth() + months);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "ACTIVE", currentPeriodEnd: end },
      });
    }

    if (body.action === "set_storage") {
      if (!body.storageGb) throw new Error("storageGb is required");
      await prisma.systemSetting.upsert({
        where: {
          organizationId_key: {
            organizationId: user.organizationId,
            key: "storage.limitGb",
          },
        },
        create: {
          organizationId: user.organizationId,
          key: "storage.limitGb",
          value: { storageGb: body.storageGb },
        },
        update: { value: { storageGb: body.storageGb } },
      });
    }

    await writeAudit({
      actorId: actor.sub,
      action: `customer.${body.action}`,
      resource: "user",
      resourceId: id,
      status: "SUCCESS",
      newValue: body,
    });

    return ok({ id, action: body.action }, undefined, "Customer updated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return fail(message, statusFor(message));
  }
}
