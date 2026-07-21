"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { pricingPlans } from "@/constants/marketing";
import { cn } from "@/lib/utils";

export default function SelectPlanPage() {
  const [interval, setInterval] = useState<"monthly" | "yearly" | "two_year">("monthly");

  return (
    <div className="relative min-h-dvh px-4 py-16">
      <div className="pointer-events-none fixed inset-0 -z-10 mesh-gradient" />
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="text-center">
          <BrandLogo href="/" width={160} className="mx-auto" />
          <h1 className="mt-6 font-display text-3xl font-semibold">Choose your plan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Monthly, yearly, or 24 months. Starter shows $0.75/mo on long-term billing.
          </p>
          <div className="mt-6 inline-flex rounded-full border border-border/60 p-1">
            {(
              [
                ["monthly", "Monthly"],
                ["yearly", "12 months"],
                ["two_year", "24 months"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setInterval(key)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm",
                  interval === key ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {pricingPlans.map((plan) => {
            const starterDiscount =
              plan.id === "starter" && (interval === "yearly" || interval === "two_year");
            return (
              <div key={plan.id} className="glass-surface flex flex-col rounded-3xl p-6">
                <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
                <p className="mt-4 font-display text-3xl font-semibold">
                  {starterDiscount ? "$0.75" : plan.price}
                  {plan.period ? (
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  ) : null}
                </p>
                {starterDiscount ? (
                  <p className="mt-1 text-xs text-gold">Billed for {interval === "yearly" ? "12" : "24"} months</p>
                ) : null}
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <Button asChild className="mt-auto gradient-blue mt-8 border-0">
                  <Link href={plan.id === "enterprise" ? "/contact?intent=enterprise" : `/signup/payment?plan=${plan.id}&interval=${interval}`}>
                    {plan.cta}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
