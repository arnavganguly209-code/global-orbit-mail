"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/features/marketing/section-heading";
import { features } from "@/constants/marketing";

export function FeaturesSection() {
  return (
    <section id="features" className="section-padding relative">
      <Container>
        <SectionHeading
          eyebrow="Features"
          title="Everything required to run enterprise email with elegance"
          description="A complete commercial surface — security, scale, white-label, and operational control."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.45 }}
              whileHover={{ y: -4 }}
              className="glass-surface group rounded-2xl p-6"
            >
              <div className="mb-4 h-px w-10 bg-gradient-to-r from-primary to-gold transition-all duration-300 group-hover:w-16" />
              <h3 className="font-display text-xl font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.article>
          ))}
        </div>
      </Container>
    </section>
  );
}
