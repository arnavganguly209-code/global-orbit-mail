import type { Metadata } from "next";
import {
  MarketingCtaRow,
  MarketingPage,
  MarketingPageHero,
} from "@/features/marketing/marketing-page";
import { HowItWorksSection } from "@/features/marketing/how-it-works-section";

export const metadata: Metadata = { title: "Business Email" };

export default function BusinessEmailPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Business Email"
        title="Professional email on your domain."
        description="Host you@yourcompany.com with MX, SPF, DKIM, and DMARC guidance — then open a modern webmail experience."
      >
        <MarketingCtaRow />
      </MarketingPageHero>
      <HowItWorksSection />
    </MarketingPage>
  );
}
