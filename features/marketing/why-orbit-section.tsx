"use client";

import { BadgeCheck, Layers3, Palette, Gauge } from "lucide-react";
import { Container } from "@/components/ui/container";
import { GlassPanel } from "@/components/shared/glass-panel";
import { SectionHeading } from "@/features/marketing/section-heading";
import { brand } from "@/config/brand";

const reasons = [
  {
    icon: Palette,
    title: "White-label by design",
    description: "Present a branded mail experience that feels native to your organization.",
  },
  {
    icon: Layers3,
    title: "Multi-domain control",
    description: "Run brands, subsidiaries, and client domains from one calm control plane.",
  },
  {
    icon: Gauge,
    title: "Operational clarity",
    description: "DNS, mailboxes, and policies are visible — not hidden behind consumer UX.",
  },
  {
    icon: BadgeCheck,
    title: "Enterprise posture",
    description: "Built for teams that need uptime, authentication, and support that scales.",
  },
];

export function WhyOrbitSection() {
  return (
    <section id="why" className="section-padding relative">
      <Container>
        <SectionHeading
          eyebrow="Why Global Orbit"
          title={`Why teams choose ${brand.product}`}
          description="A premium alternative for organizations that want branded, controllable business email without compromising on craft or control."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {reasons.map((reason) => (
            <GlassPanel key={reason.title} className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <reason.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight">
                    {reason.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {reason.description}
                  </p>
                </div>
              </div>
            </GlassPanel>
          ))}
        </div>
      </Container>
    </section>
  );
}
