"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/features/marketing/section-heading";
import { pricingPlans } from "@/constants/marketing";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";
import {
  BILLING_CYCLE_OPTIONS,
  quotePlanPrice,
  type BillingCycle,
  type PublicPlanKey,
} from "@/lib/billing/pricing";

export function PricingSection() {
  const [cycle, setCycle] = React.useState<BillingCycle>("MONTHLY");

  return (
    <section id="pricing" className="section-padding relative">
      <Container>
        <SectionHeading
          eyebrow="Pricing"
          title="Clear plans. Premium outcomes."
          description="Monthly, 12-month, or 24-month billing. Switch the cycle — prices update instantly."
        />

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-border/70 bg-background/40 p-1 backdrop-blur">
            {BILLING_CYCLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCycle(opt.value)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
                  cycle === opt.value
                    ? "bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan, index) => {
            const quote = quotePlanPrice(plan.id as PublicPlanKey, cycle);
            return (
              <motion.article
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
                whileHover={{ y: -6 }}
                className={cn(
                  "relative flex flex-col rounded-3xl p-7",
                  plan.featured
                    ? "gradient-blue-gold p-[1px] shadow-2xl shadow-primary/20"
                    : "glass-surface",
                )}
              >
                <div
                  className={cn(
                    "flex h-full flex-col rounded-[1.4rem]",
                    plan.featured ? "bg-[#070b14] p-7" : "",
                  )}
                >
                  {plan.featured && "badge" in plan && plan.badge ? (
                    <Badge variant="gold" className="mb-4 w-fit">
                      {plan.badge}
                    </Badge>
                  ) : (
                    <div className="mb-4 h-6" />
                  )}
                  <h3 className="font-display text-2xl font-semibold tracking-tight">{plan.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${plan.id}-${cycle}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="mt-6"
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-4xl font-semibold tracking-tight">
                          {quote.contactSales ? "Contact Sales" : quote.label}
                        </span>
                        {!quote.contactSales ? (
                          <span className="text-sm text-muted-foreground">{quote.periodLabel}</span>
                        ) : null}
                      </div>
                      {quote.billingNote ? (
                        <p className="mt-2 text-sm text-gold">{quote.billingNote}</p>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                  <ul className="mt-8 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-gold" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    <Button
                      asChild
                      className={cn("w-full", plan.featured ? "gradient-blue border-0" : "")}
                      variant={plan.featured ? "default" : "outline"}
                      size="lg"
                    >
                      <Link
                        href={
                          quote.contactSales
                            ? "/contact?intent=enterprise"
                            : `${routes.signup}?plan=${plan.id}`
                        }
                      >
                        {quote.contactSales ? "Contact Sales" : "Get Started"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
