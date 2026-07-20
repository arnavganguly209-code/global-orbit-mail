"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/features/marketing/section-heading";
import { testimonials } from "@/constants/marketing";

export function TestimonialsSection() {
  const [index, setIndex] = React.useState(0);
  const active = testimonials[index];

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % testimonials.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section id="resources" className="section-padding relative">
      <Container>
        <SectionHeading
          eyebrow="Testimonials"
          title="Trusted by operators who care about craft"
          description="Leaders choosing branded mail infrastructure with executive polish."
        />
        <div className="relative mx-auto mt-14 max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={active.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="glass-surface premium-shadow rounded-3xl p-8 sm:p-10"
            >
              <Quote className="mb-6 size-6 text-gold" />
              <p className="font-display text-xl leading-relaxed tracking-tight sm:text-2xl">
                “{active.quote}”
              </p>
              <footer className="mt-8 border-t border-border/60 pt-6">
                <p className="font-semibold">{active.name}</p>
                <p className="text-sm text-muted-foreground">
                  {active.role} · {active.company}
                </p>
              </footer>
            </motion.blockquote>
          </AnimatePresence>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous testimonial"
              onClick={() =>
                setIndex((current) => (current - 1 + testimonials.length) % testimonials.length)
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex gap-2">
              {testimonials.map((item, i) => (
                <button
                  key={item.name}
                  type="button"
                  aria-label={`Show testimonial ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-8 bg-gold" : "w-2 bg-muted"
                  }`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next testimonial"
              onClick={() => setIndex((current) => (current + 1) % testimonials.length)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
