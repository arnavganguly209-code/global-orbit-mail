import { ok, fail, parseJson } from "@/lib/api/response";
import { requireCustomerActor } from "@/lib/api/actor";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const bodySchema = z.object({
  planKey: z.enum(["starter", "business", "enterprise"]),
  interval: z.enum(["monthly", "yearly", "two_year"]).default("monthly"),
});

export async function POST(request: Request) {
  try {
    const actor = await requireCustomerActor();
    if (!actor.organizationId) return fail("Organization required", 400);
    const body = bodySchema.parse(await parseJson(request));
    if (body.planKey === "enterprise") {
      return fail("Enterprise requires sales contact", 400);
    }
    const plan = await prisma.plan.findUnique({ where: { key: body.planKey } });
    if (!plan) return fail("Plan not found", 404);

    const interval =
      body.interval === "yearly" ? "YEARLY" : body.interval === "two_year" ? "TWO_YEAR" : "MONTHLY";
    const amount =
      interval === "YEARLY"
        ? Number(plan.yearlyPriceUsd ?? plan.monthlyPriceUsd)
        : interval === "TWO_YEAR"
          ? Number(plan.twoYearPriceUsd ?? plan.monthlyPriceUsd)
          : Number(plan.monthlyPriceUsd);

    const now = new Date();
    const end = new Date(now);
    if (interval === "YEARLY") end.setFullYear(end.getFullYear() + 1);
    else if (interval === "TWO_YEAR") end.setFullYear(end.getFullYear() + 2);
    else end.setMonth(end.getMonth() + 1);

    const subscription = await prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findFirst({
        where: { organizationId: actor.organizationId! },
        orderBy: { createdAt: "desc" },
      });
      const sub = existing
        ? await tx.subscription.update({
            where: { id: existing.id },
            data: {
              planId: plan.id,
              status: "ACTIVE",
              interval,
              currentPeriodStart: now,
              currentPeriodEnd: end,
              ownerId: actor.sub,
            },
          })
        : await tx.subscription.create({
            data: {
              organizationId: actor.organizationId!,
              ownerId: actor.sub,
              planId: plan.id,
              status: "ACTIVE",
              interval,
              currentPeriodStart: now,
              currentPeriodEnd: end,
            },
          });

      await tx.order.create({
        data: {
          organizationId: actor.organizationId!,
          subscriptionId: sub.id,
          amountUsd: amount,
          status: "PAID",
          provider: "manual",
          metadata: { architecture: true },
        },
      });

      await tx.invoice.create({
        data: {
          organizationId: actor.organizationId!,
          subscriptionId: sub.id,
          number: `INV-${Date.now()}`,
          amountUsd: amount,
          status: "PAID",
          paidAt: now,
        },
      });

      await tx.organization.update({
        where: { id: actor.organizationId! },
        data: { status: "ACTIVE" },
      });

      return sub;
    });

    await writeAudit({
      actorId: actor.sub,
      action: "billing.activate",
      resource: "subscription",
      resourceId: subscription.id,
      metadata: { planKey: body.planKey, interval },
    });

    return ok({ subscriptionId: subscription.id, status: "ACTIVE" }, undefined, "Subscription active");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activation failed";
    return fail(message, message === "Unauthorized" || message === "Forbidden" ? 401 : 400);
  }
}
