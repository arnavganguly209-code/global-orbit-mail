import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AdminLoginForm } from "@/features/auth/admin-login-form";
import { Loading } from "@/components/ui/loading";

export const metadata: Metadata = {
  title: "Admin Portal",
  description: "GLOBAL ORBIT MAIL super admin console sign in.",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <AuroraBackground className="min-h-dvh">
      <div className="noise-overlay absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),transparent_45%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" aria-label="Home">
            <BrandLogo href={null} priority width={240} className="w-[200px] sm:w-[240px]" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="rounded-3xl p-[1px] gradient-blue-gold shadow-2xl shadow-primary/20">
          <div className="rounded-[1.4rem] bg-[#070b14] p-8 sm:p-10">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold">
              Super Admin
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
              Command center
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Database-backed admin authentication. Sessions are stored in PostgreSQL.
            </p>
            <div className="mt-8">
              <Suspense fallback={<Loading label="Loading sign-in" />}>
                <AdminLoginForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
