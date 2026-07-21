"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";

const logos = [
  "Northbridge",
  "Helix Mfg",
  "Agency Ledger",
  "Orbit Ventures",
  "Summit Legal",
  "Aether Labs",
];

export function TrustedBySection() {
  return (
    <section aria-label="Trusted by" className="relative border-y border-border/50 py-10">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.04] to-transparent" />
      <Container className="relative">
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Trusted by teams who treat email as infrastructure
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14">
          {logos.map((name, index) => (
            <motion.span
              key={name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="font-display text-sm font-semibold tracking-[0.08em] text-muted-foreground/70 sm:text-base"
            >
              {name}
            </motion.span>
          ))}
        </div>
      </Container>
    </section>
  );
}
