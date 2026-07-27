/**
 * Admin billing — plans, subscriptions, orders, invoices, coupons, activation.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit, writeActivity } from "@/lib/audit";

function toNum(v: unknown) {
  return v == null ? null : Number(v);
}

const planSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_-]+$/i),
  name: z.string().min(1),
  description: z.string().optional(),
  monthlyPriceUsd: z.number().nonnegative(),
  yearlyPriceUsd: z.number().nonnegative().optional(),
  twoYearPriceUsd: z.number().nonnegative().optional(),
  storageGb: z.number().int().positive(),
  mailboxLimit: z.number().int().positive(),
  domainLimit: z.number().int().positive().default(1),
  features: z.array(z.string()).default([]),
  isPublic: z.boolean().default(true),
  contactSales: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const couponSchema = z.object({
  code: z.string().min(2).transform((s) => s.toUpperCase()),
  percentOff: z.number().int().min(1).max(100).optional(),
  amountOffUsd: z.number().positive().optional(),
  active: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  maxRedemptions: z.number().int().positive().optional(),
});

const activateSchema = z.object({
  organizationId: z.string().uuid(),
  planKey: z.string().min(1),
  interval: z.enum(["MONTHLY", "YEARLY", "TWO_YEAR"]).default("MONTHLY"),
  couponCode: z.string().optional(),
});

function periodDays(interval: "MONTHLY" | "YEARLY" | "TWO_YEAR") {
  if (interval === "YEARLY") return 365;
  if (interval === "TWO_YEAR") return 730;
  return 30;
}

function priceForPlan(
  plan: { monthlyPriceUsd: unknown; yearlyPriceUsd: unknown; twoYearPriceUsd: unknown },
  interval: "MONTHLY" | "YEARLY" | "TWO_YEAR",
) {
  if (interval === "YEARLY" && plan.yearlyPriceUsd != null) return Number(plan.yearlyPriceUsd);
  if (interval === "TWO_YEAR" && plan.twoYearPriceUsd != null) return Number(plan.twoYearPriceUsd);
  return Number(plan.monthlyPriceUsd);
}

export const billingAdminService = {
  async listPlans() {
    const rows = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    return rows.map((p) => ({
      ...p,
      monthlyPriceUsd: toNum(p.monthlyPriceUsd),
      yearlyPriceUsd: toNum(p.yearlyPriceUsd),
      twoYearPriceUsd: toNum(p.twoYearPriceUsd),
      features: (p.features as string[]) ?? [],
    }));
  },

  async createPlan(body: unknown, actorId: string) {
    const input = planSchema.parse(body);
    const plan = await prisma.plan.create({
      data: {
        ...input,
        features: input.features,
      },
    });
    await writeAudit({ actorId, action: "plan.create", resource: "plan", resourceId: plan.id });
    return plan;
  },

  async updatePlan(id: string, body: unknown, actorId: string) {
    const input = planSchema.partial().parse(body);
    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...input,
        features: input.features,
      },
    });
    await writeAudit({ actorId, action: "plan.update", resource: "plan", resourceId: id });
    return plan;
  },

  async deletePlan(id: string, actorId: string) {
    const subs = await prisma.subscription.count({ where: { planId: id } });
    if (subs > 0) throw new Error("Plan has active subscriptions");
    await prisma.plan.delete({ where: { id } });
    await writeAudit({ actorId, action: "plan.delete", resource: "plan", resourceId: id });
    return { ok: true };
  },

  async listSubscriptions(params: { page?: number; pageSize?: number; status?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 25);
    const where = params.status ? { status: params.status as never } : {};
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          plan: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.subscription.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  async listOrders(params: { page?: number; pageSize?: number; status?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 25);
    const where = params.status ? { status: params.status as never } : {};
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);
    return {
      items: items.map((o) => ({ ...o, amountUsd: Number(o.amountUsd) })),
      total,
      page,
      pageSize,
    };
  },

  async listInvoices(params: { page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, params.pageSize ?? 25);
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { issuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count(),
    ]);
    return {
      items: items.map((i) => ({ ...i, amountUsd: Number(i.amountUsd) })),
      total,
      page,
      pageSize,
    };
  },

  async listCoupons() {
    const rows = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
    const redemptionCounts = await prisma.couponRedemption.groupBy({
      by: ["couponId"],
      _count: { _all: true },
    });
    const countMap = new Map(redemptionCounts.map((r) => [r.couponId, r._count._all]));
    return rows.map((c) => ({
      ...c,
      amountOffUsd: toNum(c.amountOffUsd),
      redemptions: countMap.get(c.id) ?? 0,
    }));
  },

  async createCoupon(body: unknown, actorId: string) {
    const input = couponSchema.parse(body);
    if (!input.percentOff && !input.amountOffUsd) {
      throw new Error("Coupon requires percentOff or amountOffUsd");
    }
    const coupon = await prisma.coupon.create({
      data: {
        ...input,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
    await writeAudit({ actorId, action: "coupon.create", resource: "coupon", resourceId: coupon.id });
    return coupon;
  },

  async updateCoupon(id: string, body: unknown, actorId: string) {
    const input = couponSchema.partial().parse(body);
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...input,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
    });
    await writeAudit({ actorId, action: "coupon.update", resource: "coupon", resourceId: id });
    return coupon;
  },

  async activateSubscription(body: unknown, actorId: string) {
    const input = activateSchema.parse(body);
    const plan = await prisma.plan.findUnique({ where: { key: input.planKey } });
    if (!plan) throw new Error("Plan not found");

    let amount = priceForPlan(plan, input.interval);
    let couponId: string | null = null;

    if (input.couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: input.couponCode.toUpperCase() } });
      if (!coupon || !coupon.active) throw new Error("Invalid coupon");
      if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new Error("Coupon expired");
      const used = await prisma.couponRedemption.count({ where: { couponId: coupon.id } });
      if (coupon.maxRedemptions != null && used >= coupon.maxRedemptions) {
        throw new Error("Coupon redemption limit reached");
      }
      if (coupon.percentOff) amount = amount * (1 - coupon.percentOff / 100);
      else if (coupon.amountOffUsd) amount = Math.max(0, amount - Number(coupon.amountOffUsd));
      couponId = coupon.id;
    }

    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + periodDays(input.interval) * 86_400_000);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findFirst({
        where: { organizationId: input.organizationId },
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
              organizationId: input.organizationId,
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
          organizationId: input.organizationId,
          subscriptionId: subscription.id,
          amountUsd: amount,
          currency: "USD",
          status: "PAID",
          provider: "manual",
          metadata: { planKey: plan.key, interval: input.interval, activatedBy: actorId },
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          organizationId: input.organizationId,
          subscriptionId: subscription.id,
          number: `INV-${Date.now().toString(36).toUpperCase()}`,
          amountUsd: amount,
          status: "PAID",
          paidAt: new Date(),
        },
      });

      if (couponId) {
        await tx.couponRedemption.create({
          data: { couponId, organizationId: input.organizationId, orderId: order.id },
        });
      }

      await tx.organization.update({
        where: { id: input.organizationId },
        data: { status: "ACTIVE" },
      });

      return { subscription, order, invoice };
    });

    await writeAudit({
      actorId,
      action: "subscription.admin_activate",
      resource: "subscription",
      resourceId: result.subscription.id,
      metadata: { organizationId: input.organizationId, planKey: plan.key, amount },
    });

    await writeActivity({
      actorId,
      organizationId: input.organizationId,
      category: "billing",
      message: `Admin activated ${plan.name} subscription`,
      severity: "info",
    });

    return result;
  },

  async getRevenueSummary() {
    const [paid, pending, mrrPlans] = await Promise.all([
      prisma.order.aggregate({ _sum: { amountUsd: true }, where: { status: "PAID" } }),
      prisma.order.aggregate({ _sum: { amountUsd: true }, where: { status: "PENDING" } }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        include: { plan: true },
      }),
    ]);

    let mrr = 0;
    for (const s of mrrPlans) {
      if (s.interval === "MONTHLY") mrr += Number(s.plan.monthlyPriceUsd);
      else if (s.interval === "YEARLY" && s.plan.yearlyPriceUsd) {
        mrr += Number(s.plan.yearlyPriceUsd) / 12;
      } else if (s.interval === "TWO_YEAR" && s.plan.twoYearPriceUsd) {
        mrr += Number(s.plan.twoYearPriceUsd) / 24;
      }
    }

    return {
      totalPaidUsd: Number(paid._sum.amountUsd ?? 0),
      pendingUsd: Number(pending._sum.amountUsd ?? 0),
      activeSubscriptions: mrrPlans.length,
      estimatedMrrUsd: Math.round(mrr * 100) / 100,
    };
  },
};
