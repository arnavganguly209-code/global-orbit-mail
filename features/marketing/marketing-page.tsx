"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

export function MarketingPageHero({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden pb-10 pt-20 sm:pb-14 sm:pt-28", className)}>
      <div className="pointer-events-none absolute inset-0 mesh-gradient opacity-70" />
      <Container className="relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {eyebrow ? (
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-gold">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mx-auto max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            {title}
          </h1>
          {description ? (
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {description}
            </p>
          ) : null}
        </motion.div>
        {children ? <div className="mt-10">{children}</div> : null}
      </Container>
    </section>
  );
}
