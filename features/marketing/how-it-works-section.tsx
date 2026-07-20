"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/features/marketing/section-heading";
import { howItWorks } from "@/constants/marketing";

export function HowItWorksSection() {
  return (
    <section id="solutions" className="section-padding relative">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From domain to delivery in six precise steps"
          description="A calm onboarding path designed for operators, not guesswork."
        />
        <div className="relative mx-auto mt-16 max-w-4xl">
          <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-primary/60 via-gold/40 to-transparent md:left-1/2 md:block" />
          <ol className="space-y-6">
            {howItWorks.map((step, index) => (
              <motion.li
                key={step.step}
                initial={{ opacity: 0, x: index % 2 === 0 ? -24 : 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5 }}
                className={`relative md:flex md:items-center ${
                  index % 2 === 0 ? "md:justify-start" : "md:justify-end"
                }`}
              >
                <div
                  className={`glass-surface w-full rounded-2xl p-6 md:w-[calc(50%-2rem)] ${
                    index % 2 === 0 ? "md:mr-auto" : "md:ml-auto"
                  }`}
                >
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
                    {step.step}
                  </div>
                  <h3 className="font-display text-2xl font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
