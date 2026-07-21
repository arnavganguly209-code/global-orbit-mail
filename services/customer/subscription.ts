/**
 * Customer subscription/billing architecture — manual "Complete Payment"
 * activation stub. Wires Plan → Subscription → Order → Invoice so the
 * billing surfaces have real, org-scoped data without a payment gateway.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeActivity, writeAudit } from "@/lib/audit";

const activateSchema = z.object({
  planKey: z.string().min(1),
  interval: z.enum(["MONTHLY", "YEARLY", "TWO_YEAR"]).optional().default("MONTHLY"),
});

function toNumber(value: unknown) {
  if (value == null) return null;
  return Number(value);
}

function serializePlan(plan: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyPriceUsd: unknown;
  yearlyPriceUsd: unknown;
  twoYearPriceUsd: unknown;
  storageGb: number;
  mailboxLimit: number;
  domainLimit: number;
  features: unknown;
  contactSales: boolean;
}) {
  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    monthlyPriceUsd: toNumber(plan.monthlyPriceUsd),
    yearlyPriceUsd: toNumber(plan.yearlyPriceUsd),
    twoYearPriceUsd: toNumber(plan.twoYearPriceUsd),
    storageGb: plan.storageGb,
    mailboxLimit: plan.mailboxLimit,
    domainLimit: plan.domainLimit,
    features: (plan.features as string[]) ?? [],
    contactSales: plan.contactSales,
  };
}

function priceForInterval(
  plan: { monthlyPriceUsd: unknown; yearlyPriceUsd: unknown; twoYearPriceUsd: unknown },
  interval: "MONTHLY" | "YEARLY" | "TWO_YEAR",
) {
  if (interval === "YEARLY" && plan.yearlyPriceUsd != null) return Number(plan.yearlyPriceUsd);
  if (interval === "TWO_YEAR" && plan.twoYearPriceUsd != null) return Number(plan.twoYearPriceUsd);
  return Number(plan.monthlyPriceUsd);
}

function periodDaysFor(interval: "MONTHLY" | "YEARLY" | "TWO_YEAR") {
  if (interval === "YEARLY") return 365;
  if (interval === "TWO_YEAR") return 730;
  return 30;
}

export const subscriptionService = {
  async listPlans() {
    const plans = await prisma.plan.findMany({
      where: { isPublic: true },
      orderBy: { sortOrder: "asc" },
    });
    return plans.map(serializePlan);
  },

  async getForOrganization(organizationId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
    if (!subscription) return null;
    return {
      id: subscription.id,
      status: subscription.status,
      interval: subscription.interval,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      plan: serializePlan(subscription.plan),
    };
  },

  async listOrders(organizationId: string) {
    const orders = await prisma.order.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return orders.map((order) => ({
      id: order.id,
      amountUsd: Number(order.amountUsd),
      currency: order.currency,
      status: order.status,
      provider: order.provider,
      createdAt: order.createdAt.toISOString(),
    }));
  },

  async listInvoices(organizationId: string) {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { issuedAt: "desc" },
      take: 50,
    });
    return invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amountUsd: Number(invoice.amountUsd),
      status: invoice.status,
      issuedAt: invoice.issuedAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() ?? null,
    }));
  },

  async activate(
    body: unknown,
    organizationId: string,
    actorId: string,
  ) {
    const input = activateSchema.parse(body);
    const plan = await prisma.plan.findUnique({ where: { key: input.planKey } });
    if (!plan) throw new Error("Plan not found");

    const amount = priceForInterval(plan, input.interval);
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + periodDaysFor(input.interval) * 86_400_000);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });

      const subscription = existing
        ? await tx.subscription.update({
            where: { id: existing.id },
            data: {
              planId: plan.id,
              ownerId: actorId,
              status: "ACTIVE",
              interval: input.interval,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
            },
          })
        : await tx.subscription.create({
            data: {
              organizationId,
              ownerId: actorId,
              planId: plan.id,
              status: "ACTIVE",
              interval: input.interval,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            },
          });

      const order = await tx.order.create({
        data: {
          organizationId,
          subscriptionId: subscription.id,
          amountUsd: amount,
          currency: "USD",
          status: "PAID",
          provider: "manual",
          metadata: { planKey: plan.key, interval: input.interval },
        },
      });

      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          subscriptionId: subscription.id,
          number: invoiceNumber,
          amountUsd: amount,
          status: "PAID",
          paidAt: new Date(),
        },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: { status: "ACTIVE" },
      });

      return { subscription, order, invoice };
    });

    await writeAudit({
      actorId,
      action: "subscription.activate",
      resource: "subscription",
      resourceId: result.subscription.id,
      metadata: { planKey: plan.key, interval: input.interval, amount },
    });

    await writeActivity({
      actorId,
      organizationId,
      category: "billing",
      message: `Subscription activated on the ${plan.name} plan`,
      severity: "info",
    });

    return this.getForOrganization(organizationId);
  },
};
