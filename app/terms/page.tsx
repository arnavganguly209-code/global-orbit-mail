import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/layout";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <MarketingShell>
      <Container className="section-padding max-w-3xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-4 text-muted-foreground">
          The complete commercial terms for GLOBAL ORBIT MAIL will be published here before
          customer onboarding. Contact{" "}
          <a className="text-primary" href="mailto:legal@theglobalorbit.com">
            legal@theglobalorbit.com
          </a>{" "}
          for enterprise agreements.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm text-gold hover:underline">
          Back to home
        </Link>
      </Container>
    </MarketingShell>
  );
}
