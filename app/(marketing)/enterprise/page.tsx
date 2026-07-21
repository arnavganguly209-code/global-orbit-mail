import type { Metadata } from "next";
import { Building2, Globe2, Headphones, ShieldCheck } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingPageHero } from "@/features/marketing/marketing-page";
import { ComparisonSection } from "@/features/marketing/comparison-section";
import { TestimonialsSection } from "@/features/marketing/testimonials-section";
import { CtaSection } from "@/features/marketing/cta-section";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";

export const metadata: Metadata = {
  title: "Enterprise",
  description:
    "Unlimited domains, unlimited mailboxes, dedicated infrastructure, and 24/7 support for large organizations and agencies.",
};

const capabilities = [
  {
    icon: Globe2,
    title: "Unlimited domains & mailboxes",
    description: "Consolidate every brand, subsidiary, or client under one control plane.",
  },
  {
    icon: Building2,
    title: "Dedicated infrastructure",
    description: "Isolated resources and dedicated IP options for deliverability at scale.",
  },
  {
    icon: ShieldCheck,
    title: "Security & compliance ready",
    description: "SPF, DKIM, DMARC, SSL, and audit trails built for regulated industries.",
  },
  {
    icon: Headphones,
    title: "24/7 white-glove support",
    description: "A dedicated success team for onboarding, migration, and incident response.",
  },
];

export default function EnterprisePage() {
  return (
    <MarketingShell>
      <MarketingPageHero
        eyebrow="Enterprise"
        title="Mail infrastructure built for organizations at scale"
        description="Dedicated resources, unlimited scale, and white-label control for enterprises, agencies, and multi-brand operators."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="gradient-blue border-0">
            <a href="/contact?intent=enterprise">Talk to Sales</a>
          </Button>
        </div>
      </MarketingPageHero>

      <section className="section-padding relative">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item) => (
              <GlassPanel key={item.title} className="p-6">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <item.icon className="size-5" />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </GlassPanel>
            ))}
          </div>
        </Container>
      </section>

      <ComparisonSection />
      <TestimonialsSection />
      <CtaSection />
    </MarketingShell>
  );
}
