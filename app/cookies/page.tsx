import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/layout";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Cookies" };

export default function CookiesPage() {
  return (
    <MarketingShell>
      <Container className="section-padding max-w-3xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Cookie Policy</h1>
        <p className="mt-4 text-muted-foreground">
          GLOBAL ORBIT MAIL uses essential cookies for theme preference and session readiness.
          A full cookie disclosure will accompany production release.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm text-gold hover:underline">
          Back to home
        </Link>
      </Container>
    </MarketingShell>
  );
}
