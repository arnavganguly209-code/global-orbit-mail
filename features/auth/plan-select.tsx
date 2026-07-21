"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { customerFetch } from "@/lib/api/customer-fetch";
import { pricingPlans } from "@/constants/marketing";
import { cn } from "@/lib/utils";

interface PlanOption {
  key: string;
  name: string;
  description: string | null;
  monthlyPriceUsd: number | null;
  contactSales: boolean;
  features: string[];
}

async function fetchPlans(): Promise<PlanOption[]> {
  const res = await customerFetch("/api/customer/plans");
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error("Failed to load plans");
  return json.data;
}

export function PlanSelect() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-plans"],
    queryFn: fetchPlans,
  });

  const plans: PlanOption[] =
    data && data.length > 0
      ? data
      : pricingPlans.map((plan) => ({
          key: plan.id,
          name: plan.name,
          description: plan.description,
          monthlyPriceUsd: null,
          contactSales: plan.id === "enterprise",
          features: [...plan.features],
        }));

  function choose(planKey: string) {
    if (plans.find((p) => p.key === planKey)?.contactSales) {
      router.push("/contact?intent=enterprise");
      return;
    }
    setPending(planKey);
    router.push(`/signup/payment?plan=${planKey}`);
  }

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {isLoading && !data
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-surface h-72 animate-pulse rounded-2xl" />
          ))
        : plans.map((plan, index) => (
            <div
              key={plan.key}
              className={cn(
                "flex flex-col rounded-2xl p-6",
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
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {plan.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-semibold tracking-tight">
                    {plan.contactSales || plan.monthlyPriceUsd == null
                      ? "Custom"
                      : `$${plan.monthlyPriceUsd}`}
                  </span>
                  {!plan.contactSales && plan.monthlyPriceUsd != null ? (
                    <span className="text-xs text-muted-foreground">/month</span>
                  ) : null}
                </div>
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
                    disabled={pending === plan.key}
                    onClick={() => choose(plan.key)}
                  >
                    {pending === plan.key ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : plan.contactSales ? (
                      "Contact Sales"
                    ) : (
                      "Select Plan"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
    </div>
  );
}
