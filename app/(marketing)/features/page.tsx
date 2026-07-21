import type { Metadata } from "next";
import {
  MarketingCtaRow,
  MarketingPage,
  MarketingPageHero,
} from "@/features/marketing/marketing-page";
import { FeaturesSection } from "@/features/marketing/features-section";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Features" };

export default function FeaturesPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Platform"
        title="Everything your business email needs."
        description="Domains, mailboxes, authentication, spam defense, and a premium webmail experience — in one SaaS platform."
      >
        <MarketingCtaRow />
      </MarketingPageHero>
      <FeaturesSection />
      <Container className="pb-20">
        <p className="text-sm text-muted-foreground">
          DNS, SSL, and mail engine integrations are prepared for production rollout.
        </p>
      </Container>
    </MarketingPage>
  );
}
