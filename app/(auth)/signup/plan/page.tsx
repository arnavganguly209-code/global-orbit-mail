import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Container } from "@/components/ui/container";
import { PlanSelect } from "@/features/auth/plan-select";

export const metadata: Metadata = {
  title: "Choose Your Plan",
  robots: { index: false, follow: false },
};

export default function SignupPlanPage() {
  return (
    <AuroraBackground className="min-h-dvh py-16">
      <div className="noise-overlay absolute inset-0" />
      <Container size="lg" className="relative z-10">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" aria-label="Home">
            <BrandLogo href={null} priority width={220} className="w-[180px] sm:w-[220px]" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold">
            Step 2 of 3
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Choose your plan
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Every plan includes custom domains, SSL, and enterprise-grade DNS authentication.
            Upgrade or change plans anytime from billing.
          </p>
        </div>
        <div className="mt-12">
          <PlanSelect />
        </div>
      </Container>
    </AuroraBackground>
  );
}
