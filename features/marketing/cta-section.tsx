"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { external } from "@/config/routes";

export function CtaSection() {
  return (
    <section id="contact" className="section-padding relative">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2rem] p-[1px] gradient-blue-gold"
        >
          <div className="relative rounded-[1.95rem] bg-[#060a12] px-8 py-16 text-center sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute inset-0 mesh-gradient opacity-60" />
            <div className="relative z-10 mx-auto max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-gold">
                Get started
              </p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                Start Your Business Email Today
              </h2>
              <p className="mt-4 text-muted-foreground">
                Launch branded, secure enterprise mail in minutes — then grow without
                ceiling.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="gradient-blue h-12 border-0 px-8 shadow-xl shadow-primary/30"
                >
                  <a href={external.webmail} target="_blank" rel="noopener noreferrer">
                    Sign Up
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/15 bg-white/5 px-8"
                >
                  <a href={external.admin} target="_blank" rel="noopener noreferrer">
                    Admin Portal
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
