import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/layout";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPage() {
  return (
    <MarketingShell>
      <Container className="section-padding max-w-3xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Refund Policy</h1>
        <p className="mt-4 text-muted-foreground">
          Refund eligibility and service credits for GLOBAL ORBIT MAIL will be detailed here
          as part of commercial launch documentation.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm text-gold hover:underline">
          Back to home
        </Link>
      </Container>
    </MarketingShell>
  );
}
