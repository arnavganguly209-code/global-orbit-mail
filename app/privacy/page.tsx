import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/layout";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <Container className="section-padding max-w-3xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-4 text-muted-foreground">
          GLOBAL ORBIT PVT. LTD. respects your privacy. This page will publish the full
          enterprise privacy policy prior to production onboarding. For inquiries, contact{" "}
          <a className="text-primary" href="mailto:support@theglobalorbit.com">
            support@theglobalorbit.com
          </a>
          .
        </p>
        <Link href="/" className="mt-8 inline-block text-sm text-gold hover:underline">
          Back to home
        </Link>
      </Container>
    </MarketingShell>
  );
}
