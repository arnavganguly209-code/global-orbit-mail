"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { ArrowRight, ArrowDown } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { external, routes } from "@/config/routes";
import { brand } from "@/config/brand";

export function HeroSection() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 40, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 40, damping: 20 });

  function onMove(event: React.MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x * 28);
    mouseY.set(y * 20);
  }

  return (
    <section
      className="relative isolate min-h-[calc(100dvh-5rem)] overflow-hidden"
      onMouseMove={onMove}
    >
      <div className="pointer-events-none absolute inset-0 mesh-gradient" />
      <div className="noise-overlay absolute inset-0" />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,var(--aurora-1),transparent_70%)] blur-3xl animate-aurora"
        style={{ x: springX, y: springY }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-24 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,var(--aurora-3),transparent_70%)] blur-3xl animate-pulse-glow"
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-[radial-gradient(circle,var(--aurora-2),transparent_70%)] blur-3xl animate-float"
      />

      <Container className="relative z-10 flex min-h-[calc(100dvh-5rem)] flex-col justify-center py-16 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-5xl text-center"
        >
          <div className="mb-10 flex justify-center">
            <BrandLogo href={null} priority width={240} className="w-[200px] sm:w-[240px]" />
          </div>

          <p className="mb-5 text-xs font-medium uppercase tracking-[0.28em] text-gold">
            {brand.tagline}
          </p>

          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Enterprise Email Hosting
            <span className="mt-2 block gradient-text">Built For Modern Businesses</span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Secure, scalable and white-label business email hosting for startups,
            enterprises and agencies.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="gradient-blue h-12 border-0 px-7 text-base shadow-xl shadow-primary/30"
            >
              <a href={external.webmail} target="_blank" rel="noopener noreferrer">
                Start Free Trial
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 border-white/15 bg-white/5 px-7 text-base backdrop-blur-md">
              <a href={routes.sections.pricing}>
                View Pricing
                <ArrowDown className="size-4" />
              </a>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-16 w-full max-w-4xl"
        >
          <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-r from-primary/20 via-gold/10 to-primary/20 blur-2xl" />
          <div className="glass-surface premium-shadow relative overflow-hidden rounded-[1.75rem] p-1">
            <div className="rounded-[1.5rem] border border-white/5 bg-gradient-to-b from-white/[0.06] to-transparent px-6 py-10 sm:px-10 sm:py-12">
              <div className="grid gap-6 sm:grid-cols-3">
                {[
                  { label: "Deliverability", value: "SPF · DKIM · DMARC" },
                  { label: "Architecture", value: "White-label ready" },
                  { label: "Scale", value: "Unlimited potential" },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="text-center"
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      delay: index * 0.45,
                      ease: "easeInOut",
                    }}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 font-display text-lg font-semibold text-foreground">
                      {item.value}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
