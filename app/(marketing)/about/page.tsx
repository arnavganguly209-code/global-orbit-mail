import type { Metadata } from "next";
import { Compass, Gem, Rocket, Users } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingPageHero } from "@/features/marketing/marketing-page";
import { TrustSection } from "@/features/marketing/trust-section";
import { CtaSection } from "@/features/marketing/cta-section";
import { Container } from "@/components/ui/container";
import { GlassPanel } from "@/components/shared/glass-panel";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "About",
  description: `About ${brand.company} — the team behind ${brand.product}, a premium white-label enterprise email hosting platform.`,
};

const values = [
  {
    icon: Gem,
    title: "Craft over shortcuts",
    description: "Every surface is designed with the same care as the infrastructure beneath it.",
  },
  {
    icon: Compass,
    title: "Clarity by default",
    description: "Domains, DNS, and mailboxes should be understandable, not intimidating.",
  },
  {
    icon: Rocket,
    title: "Built to scale",
    description: "From a single founder to a multi-brand enterprise, the architecture doesn't change.",
  },
  {
    icon: Users,
    title: "Customer-obsessed",
    description: "Support and product decisions are shaped by the operators who rely on us daily.",
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <MarketingPageHero
        eyebrow="About"
        title={`We build mail infrastructure people are proud to run`}
        description={`${brand.company} is the team behind ${brand.product} — a premium, white-label enterprise email hosting platform for startups, agencies, and large organizations.`}
      />

      <section className="section-padding relative">
        <Container size="md">
          <GlassPanel className="p-8 sm:p-10">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Our story</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {brand.product} started from a simple frustration: business email either felt
              generic and consumer-grade, or enterprise-priced and needlessly complex. We set
              out to build a platform that feels premium from the first login — with full
              control over domains, DNS authentication, and mailbox provisioning — without
              sacrificing the operational clarity that growing teams need.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Today, {brand.product} powers branded, secure, and scalable business mail for
              organizations that refuse to compromise on how their communication looks and
              performs.
            </p>
          </GlassPanel>
        </Container>
      </section>

      <section className="section-padding relative">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <div key={value.title} className="glass-surface rounded-2xl p-6">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <value.icon className="size-5" />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <TrustSection />
      <CtaSection />
    </MarketingShell>
  );
}
