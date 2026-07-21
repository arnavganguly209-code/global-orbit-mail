"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerFetch } from "@/lib/api/customer-fetch";
import { pricingPlans } from "@/constants/marketing";
import { routes } from "@/config/routes";

interface PlanOption {
  key: string;
  name: string;
  description: string | null;
  monthlyPriceUsd: number | null;
}

async function fetchPlans(): Promise<PlanOption[]> {
  const res = await customerFetch("/api/customer/plans");
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error("Failed to load plans");
  return json.data;
}

export function PaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planKey = searchParams.get("plan") ?? "starter";
  const [submitting, setSubmitting] = React.useState(false);

  const { data } = useQuery({ queryKey: ["customer-plans"], queryFn: fetchPlans });

  const fallback = pricingPlans.find((p) => p.id === planKey);
  const plan =
    data?.find((p) => p.key === planKey) ??
    (fallback
      ? {
          key: fallback.id,
          name: fallback.name,
          description: fallback.description,
          monthlyPriceUsd: null,
        }
      : { key: planKey, name: planKey, description: "", monthlyPriceUsd: null });

  async function completePayment() {
    setSubmitting(true);
    try {
      const res = await customerFetch("/api/customer/subscription/activate", {
        method: "POST",
        body: JSON.stringify({ planKey, interval: "MONTHLY" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Activation failed");
      toast.success("Payment complete — subscription activated");
      router.replace(routes.dashboard);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-surface premium-shadow rounded-3xl p-8 sm:p-10">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold">
        Order Summary
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
        Complete your payment
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This is a payment architecture placeholder — activation is instant and no card is
        charged in this phase.
      </p>

      <div className="mt-8 rounded-2xl border border-border/60 bg-background/40 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{plan.name}</p>
            <p className="text-xs text-muted-foreground">{plan.description}</p>
          </div>
          <p className="font-display text-2xl font-semibold">
            {plan.monthlyPriceUsd != null ? `$${plan.monthlyPriceUsd}` : "Custom"}
            <span className="text-xs font-normal text-muted-foreground">/mo</span>
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-border/60 p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-gold" />
          <span>Card details are collected by the production payment gateway.</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-gold" />
          <span>PCI-compliant processing architecture ready for integration.</span>
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        className="mt-8 w-full gradient-blue border-0"
        disabled={submitting}
        onClick={completePayment}
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : "Complete Payment"}
      </Button>
    </div>
  );
}
