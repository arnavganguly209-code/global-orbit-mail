/**
 * Global Orbit Mail — public pricing math (USD).
 * Source of truth for marketing cards + signup checkout summary.
 */

export type BillingCycle = "MONTHLY" | "YEARLY" | "TWO_YEAR";

export type PublicPlanKey = "starter" | "business" | "enterprise";

export type PlanPriceQuote = {
  planKey: PublicPlanKey;
  cycle: BillingCycle;
  contactSales: boolean;
  /** Effective monthly rate shown on cards */
  effectiveMonthlyUsd: number | null;
  /** Total charged for the selected cycle */
  totalUsd: number | null;
  label: string;
  periodLabel: string;
  billingNote: string | null;
};

const STARTER = {
  monthly: 2,
  yearlyTotal: 9, // $0.75/mo × 12
  twoYearTotal: 18, // $0.75/mo × 24
} as const;

const BUSINESS = {
  monthly: 7,
  yearlyTotal: 70, // ~$5.83/mo
  twoYearTotal: 120, // $5/mo
} as const;

export function quotePlanPrice(planKey: PublicPlanKey, cycle: BillingCycle): PlanPriceQuote {
  if (planKey === "enterprise") {
    return {
      planKey,
      cycle,
      contactSales: true,
      effectiveMonthlyUsd: null,
      totalUsd: null,
      label: "Custom Quote",
      periodLabel: "",
      billingNote: "Dedicated infrastructure · SLA · migration assistance",
    };
  }

  const table = planKey === "starter" ? STARTER : BUSINESS;

  if (cycle === "MONTHLY") {
    return {
      planKey,
      cycle,
      contactSales: false,
      effectiveMonthlyUsd: table.monthly,
      totalUsd: table.monthly,
      label: `$${table.monthly}`,
      periodLabel: "/month",
      billingNote: "Billed monthly · cancel anytime",
    };
  }

  if (cycle === "YEARLY") {
    const total = table.yearlyTotal;
    const effective = Number((total / 12).toFixed(2));
    return {
      planKey,
      cycle,
      contactSales: false,
      effectiveMonthlyUsd: effective,
      totalUsd: total,
      label: `$${effective}`,
      periodLabel: "/month",
      billingNote: `$${total} billed annually · save vs monthly`,
    };
  }

  const total = table.twoYearTotal;
  const effective = Number((total / 24).toFixed(2));
  return {
    planKey,
    cycle,
    contactSales: false,
    effectiveMonthlyUsd: effective,
    totalUsd: total,
    label: `$${effective}`,
    periodLabel: "/month",
    billingNote: `$${total} billed for 24 months · best value`,
  };
}

export const BILLING_CYCLE_OPTIONS: { value: BillingCycle; label: string; short: string }[] = [
  { value: "MONTHLY", label: "Monthly", short: "Mo" },
  { value: "YEARLY", label: "12 Months", short: "12" },
  { value: "TWO_YEAR", label: "24 Months", short: "24" },
];

export const SIGNUP_DRAFT_KEY = "gom_signup_draft_v1";

export type SignupDraft = {
  name: string;
  company: string;
  country: string;
  email: string;
  phone: string;
  password: string;
  businessName: string;
  businessType: string;
  planKey?: PublicPlanKey;
  interval?: BillingCycle;
};
