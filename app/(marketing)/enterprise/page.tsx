import type { Metadata } from "next";
import {
  MarketingCtaRow,
  MarketingPage,
  MarketingPageHero,
} from "@/features/marketing/marketing-page";
import { ComparisonSection } from "@/features/marketing/comparison-section";

export const metadata: Metadata = { title: "Enterprise" };

export default function EnterprisePage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Enterprise"
        title="Dedicated infrastructure. Unlimited scale."
        description="Unlimited domains and mailboxes, dedicated IP options, priority infrastructure, and 24/7 support for mission-critical teams."
      >
        <MarketingCtaRow />
      </MarketingPageHero>
      <ComparisonSection />
    </MarketingPage>
  );
}
