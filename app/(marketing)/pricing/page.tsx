import type { Metadata } from "next";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingPageHero } from "@/features/marketing/marketing-page";
import { PricingSection } from "@/features/marketing/pricing-section";
import { ComparisonSection } from "@/features/marketing/comparison-section";
import { FaqSection } from "@/features/marketing/faq-section";
import { CtaSection } from "@/features/marketing/cta-section";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for GLOBAL ORBIT MAIL — Business Starter, Business Pro, and Enterprise plans built for every stage of growth.",
};

export default function PricingPage() {
  return (
    <MarketingShell>
      <MarketingPageHero
        eyebrow="Pricing"
        title="Clear plans. Premium outcomes."
        description="Start lean, scale into white-label power, or go unlimited with Enterprise. No hidden fees, no surprise ceilings."
      />
      <PricingSection />
      <ComparisonSection />
      <FaqSection />
      <CtaSection />
    </MarketingShell>
  );
}
