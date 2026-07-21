"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pricingPlans } from "@/constants/marketing";
import { cn } from "@/lib/utils";
import {
  BILLING_CYCLE_OPTIONS,
  quotePlanPrice,
  SIGNUP_DRAFT_KEY,
  type BillingCycle,
  type PublicPlanKey,
  type SignupDraft,
} from "@/lib/billing/pricing";

export function PlanSelect() {
  const router = useRouter();
  const [cycle, setCycle] = React.useState<BillingCycle>("MONTHLY");
  const [pending, setPending] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
      if (!raw) {
        toast.message("Start with your registration details");
        router.replace("/signup");
      }
    } catch {
      /* ignore */
    }
  }, [router]);

  function choose(planKey: PublicPlanKey) {
    if (planKey === "enterprise") {
      router.push("/contact?intent=enterprise");
      return;
    }
    if (!cycle) {
      toast.error("Select a billing cycle to continue");
      return;
    }
    setPending(planKey);
    try {
      const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
      const draft = raw ? (JSON.parse(raw) as SignupDraft) : null;
      if (draft) {
        draft.planKey = planKey;
        draft.interval = cycle;
        sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
      }
    } catch {
      /* ignore */
    }
    router.push(`/signup/payment?plan=${planKey}&interval=${cycle}`);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Billing cycle</p>
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
          {BILLING_CYCLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCycle(opt.value)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
                cycle === opt.value
                  ? "bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white shadow-lg shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">You must select a billing cycle before continuing.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {pricingPlans.map((plan, index) => {
          const key = plan.id as PublicPlanKey;
          const quote = quotePlanPrice(key, cycle);
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-0.5",
                index === 1
                  ? "gradient-blue-gold p-[1px] shadow-2xl shadow-primary/20"
                  : "glass-surface",
              )}
            >
              <div
                className={cn(
                  "flex h-full flex-col rounded-[1.05rem]",
                  index === 1 ? "bg-[#070b14] p-6" : "",
                )}
              >
                {index === 1 ? (
                  <Badge variant="gold" className="mb-3 w-fit">
                    Most Popular
                  </Badge>
                ) : (
                  <div className="mb-3 h-6" />
                )}
                <h3 className="font-display text-xl font-semibold tracking-tight">{plan.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-semibold tracking-tight">
                    {quote.contactSales ? "Custom" : quote.label}
                  </span>
                  {!quote.contactSales ? (
                    <span className="text-xs text-muted-foreground">{quote.periodLabel}</span>
                  ) : null}
                </div>
                {quote.billingNote ? (
                  <p className="mt-2 text-[11px] text-gold/90">{quote.billingNote}</p>
                ) : null}
                <ul className="mt-5 space-y-2.5">
                  {plan.features.slice(0, 6).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-gold" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Button
                    type="button"
                    className={cn("w-full", index === 1 ? "gradient-blue border-0" : "")}
                    variant={index === 1 ? "default" : "outline"}
                    disabled={pending === plan.id}
                    onClick={() => choose(key)}
                  >
                    {pending === plan.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : quote.contactSales ? (
                      "Contact Sales"
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
