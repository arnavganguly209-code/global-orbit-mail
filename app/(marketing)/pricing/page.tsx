import type { Metadata } from "next";
import {
  MarketingPage,
  MarketingPageHero,
} from "@/features/marketing/marketing-page";
import { PricingSection } from "@/features/marketing/pricing-section";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Pricing"
        title="Simple plans. Premium email."
        description="Choose Business Starter, Business Pro, or Enterprise. Yearly and 24-month billing unlock Starter at $0.75/month."
      />
      <PricingSection />
    </MarketingPage>
  );
}
