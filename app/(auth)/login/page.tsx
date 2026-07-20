import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LoginFormShell } from "@/features/auth/login-form-shell";
import { external } from "@/config/routes";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to GLOBAL ORBIT MAIL webmail.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
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
            User Portal
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Production sign-in lives at{" "}
            <a
              href={external.webmail}
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              webmail.theglobalorbit.com
            </a>
            . This page is the premium UI foundation.
          </p>
          <div className="mt-8">
            <LoginFormShell surface="user" />
          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
