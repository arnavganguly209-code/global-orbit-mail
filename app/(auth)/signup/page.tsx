import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { CustomerSignupForm } from "@/features/auth/customer-signup-form";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your GLOBAL ORBIT MAIL customer account.",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <AuroraBackground className="min-h-dvh">
      <div className="noise-overlay absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.1),transparent_45%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" aria-label="Home">
            <BrandLogo href={null} priority width={240} className="w-[200px] sm:w-[240px]" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="glass-surface premium-shadow rounded-3xl p-8 sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold">
            Get Started
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            Create your workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set up your organization, then choose a plan to activate domains and mailboxes.
          </p>
          <div className="mt-8">
            <CustomerSignupForm />
          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
