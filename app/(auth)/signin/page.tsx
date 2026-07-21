import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Loading } from "@/components/ui/loading";
import { CustomerLoginForm } from "@/features/auth/customer-login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your GLOBAL ORBIT MAIL customer dashboard.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuroraBackground className="min-h-dvh">
      <div className="noise-overlay absolute inset-0" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" aria-label="Home">
            <BrandLogo href={null} priority width={240} className="w-[200px] sm:w-[240px]" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="glass-surface premium-shadow rounded-3xl p-8 sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold">
            Customer Dashboard
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage domains, mailboxes, billing and DNS from your GLOBAL ORBIT MAIL workspace.
          </p>
          <div className="mt-8">
            <Suspense fallback={<Loading label="Loading sign-in" />}>
              <CustomerLoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
