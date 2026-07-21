import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MailCheck } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: "Verify Your Email",
  robots: { index: false, follow: false },
};

function VerifyEmailContent({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) {
  const hasToken = Boolean(searchParams.token);

  return (
    <div className="glass-surface premium-shadow rounded-3xl p-8 text-center sm:p-10">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <MailCheck className="size-6" />
      </div>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.22em] text-gold">
        {hasToken ? "Email Verification" : "One More Step"}
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
        {hasToken ? "Verifying your email…" : "Check your inbox"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {hasToken ? (
          <>
            Your verification link has been received. Email confirmation is part of the
            production architecture and will finalize automatically once mail delivery is
            enabled.
          </>
        ) : (
          <>
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">
              {searchParams.email ?? "your email address"}
            </span>
            . Click the link to verify your account. Didn&apos;t get it? Check spam or continue
            to your dashboard — verification does not block access during onboarding.
          </>
        )}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild variant="outline" className="border-white/10 bg-white/5">
          <Link href={routes.signin}>Back to Sign In</Link>
        </Button>
        <Button asChild className="gradient-blue border-0">
          <Link href={routes.dashboard}>Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;
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
        <Suspense fallback={null}>
          <VerifyEmailContent searchParams={params} />
        </Suspense>
      </div>
    </AuroraBackground>
  );
}
