"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/features/marketing/section-heading";
import { pricingPlans } from "@/constants/marketing";
import { external } from "@/config/routes";
import { cn } from "@/lib/utils";

export function PricingSection() {
  return (
    <section id="pricing" className="section-padding relative">
      <Container>
        <SectionHeading
          eyebrow="Pricing"
          title="Clear plans. Premium outcomes."
          description="Start lean, scale into white-label power, or go unlimited with Enterprise."
        />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan, index) => (
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
                <h3 className="font-display text-2xl font-semibold tracking-tight">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  {plan.period ? (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  ) : null}
                </div>
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
                    className={cn(
                      "w-full",
                      plan.featured
                        ? "gradient-blue border-0"
                        : "border-white/10 bg-white/5",
                    )}
                    variant={plan.featured ? "default" : "outline"}
                  >
                    <a
                      href={
                        plan.id === "enterprise"
                          ? "mailto:sales@theglobalorbit.com"
                          : external.webmail
                      }
                      target={plan.id === "enterprise" ? undefined : "_blank"}
                      rel={plan.id === "enterprise" ? undefined : "noopener noreferrer"}
                    >
                      {plan.cta}
                    </a>
                  </Button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </Container>
    </section>
  );
}
