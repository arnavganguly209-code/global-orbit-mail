import type { Metadata } from "next";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingPageHero } from "@/features/marketing/marketing-page";
import { FeaturesSection } from "@/features/marketing/features-section";
import { TrustSection } from "@/features/marketing/trust-section";
import { HowItWorksSection } from "@/features/marketing/how-it-works-section";
import { CtaSection } from "@/features/marketing/cta-section";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore GLOBAL ORBIT MAIL's enterprise features — unlimited mailboxes, multi-domain hosting, SPF/DKIM/DMARC, white-label branding, and real-time monitoring.",
};

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <MarketingPageHero
        eyebrow="Platform"
        title="Everything required to run enterprise email with elegance"
        description="A complete commercial surface — security, scale, white-label branding, and operational control, built for teams that expect more from mail."
      />
      <FeaturesSection />
      <TrustSection />
      <HowItWorksSection />
      <CtaSection />
    </MarketingShell>
  );
}
