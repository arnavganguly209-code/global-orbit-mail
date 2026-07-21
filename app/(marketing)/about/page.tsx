import type { Metadata } from "next";
import {
  MarketingCtaRow,
  MarketingPage,
  MarketingPageHero,
} from "@/features/marketing/marketing-page";
import { brand } from "@/config/brand";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="About"
        title={`${brand.product} by ${brand.company}`}
        description="We build premium business email hosting for companies that need deliverability, security, and a calm control plane."
      >
        <MarketingCtaRow />
      </MarketingPageHero>
      <Container className="pb-24">
        <div className="glass-surface max-w-3xl rounded-3xl p-8 text-sm leading-relaxed text-muted-foreground">
          GLOBAL ORBIT MAIL is a SaaS business email platform — marketing on the public site,
          customer operations in the dashboard, staff control in Orbit, and a premium webmail
          experience for everyday work.
        </div>
      </Container>
    </MarketingPage>
  );
}
