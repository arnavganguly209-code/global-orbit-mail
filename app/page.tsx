import { MarketingShell } from "@/components/layout";
import { HeroSection } from "@/features/marketing/hero-section";
import { TrustedBySection } from "@/features/marketing/trusted-by-section";
import { TrustSection } from "@/features/marketing/trust-section";
import { FeaturesSection } from "@/features/marketing/features-section";
import { EmailSecuritySection } from "@/features/marketing/email-security-section";
import { WhyOrbitSection } from "@/features/marketing/why-orbit-section";
import { HowItWorksSection } from "@/features/marketing/how-it-works-section";
import { MigrationSection } from "@/features/marketing/migration-section";
import { PricingSection } from "@/features/marketing/pricing-section";
import { ComparisonSection } from "@/features/marketing/comparison-section";
import { TestimonialsSection } from "@/features/marketing/testimonials-section";
import { FaqSection } from "@/features/marketing/faq-section";
import { CtaSection } from "@/features/marketing/cta-section";
import { JsonLd } from "@/features/marketing/json-ld";

export default function HomePage() {
  return (
    <MarketingShell>
      <JsonLd />
      <HeroSection />
      <TrustedBySection />
      <TrustSection />
      <FeaturesSection />
      <EmailSecuritySection />
      <WhyOrbitSection />
      <HowItWorksSection />
      <MigrationSection />
      <PricingSection />
      <ComparisonSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
    </MarketingShell>
  );
}
