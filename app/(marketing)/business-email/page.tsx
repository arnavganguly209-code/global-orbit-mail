import type { Metadata } from "next";
import { Shield, Globe2, Inbox, Lock } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingPageHero } from "@/features/marketing/marketing-page";
import { HowItWorksSection } from "@/features/marketing/how-it-works-section";
import { TrustSection } from "@/features/marketing/trust-section";
import { PricingSection } from "@/features/marketing/pricing-section";
import { CtaSection } from "@/features/marketing/cta-section";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: "Business Email",
  description:
    "Professional business email hosting on your own domain — custom addresses, spam protection, SSL, and enterprise-grade deliverability.",
};

const pillars = [
  {
    icon: Globe2,
    title: "Your domain, your identity",
    description: "Send and receive mail as you@yourcompany.com — no third-party branding.",
  },
  {
    icon: Inbox,
    title: "Unlimited mailboxes to scale",
    description: "Add teammates as you grow without renegotiating your plan.",
  },
  {
    icon: Shield,
    title: "Spam and phishing protection",
    description: "Multi-layer filtering keeps inboxes clean without blocking what matters.",
  },
  {
    icon: Lock,
    title: "SSL and full authentication",
    description: "SPF, DKIM, and DMARC configured correctly from day one.",
  },
];

export default function BusinessEmailPage() {
  return (
    <MarketingShell>
      <MarketingPageHero
        eyebrow="Business Email"
        title="Professional email that carries your brand everywhere"
        description="Replace generic addresses with a business email experience built for credibility, security, and daily executive use."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="gradient-blue border-0">
            <a href={routes.signup}>Get Started</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/10 bg-white/5">
            <a href={routes.sections.pricing}>View Pricing</a>
          </Button>
        </div>
      </MarketingPageHero>

      <section className="section-padding relative">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="glass-surface rounded-2xl p-6">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <pillar.icon className="size-5" />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{pillar.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <HowItWorksSection />
      <PricingSection />
      <TrustSection />
      <CtaSection />
    </MarketingShell>
  );
}
