import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CustomerLoginForm } from "@/features/auth/customer-login-form";
import { brand } from "@/config/brand";
import { APP_VERSION } from "@/config/version";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: "Customer Sign In",
  description: "Sign in to your GLOBAL ORBIT MAIL customer dashboard.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <div className="orbit-login-root relative min-h-dvh overflow-hidden text-white">
      <div className="orbit-login-aurora" aria-hidden />
      <div className="orbit-login-particles" aria-hidden />
      <div className="orbit-login-vignette" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-5 py-14">
        <Link href="/" className="mb-8 inline-flex flex-col items-center" aria-label={brand.product}>
          <Image
            src={brand.assets.logo}
            alt={brand.product}
            width={240}
            height={72}
            priority
            className="h-auto w-[220px] drop-shadow-[0_12px_40px_rgba(47,111,237,0.35)] sm:w-[240px]"
          />
          <p className="mt-4 text-[13px] font-medium tracking-[0.28em] text-white/55 uppercase">
            Enterprise Mail Platform
          </p>
          <p className="mt-3 text-[10px] font-semibold tracking-[0.22em] text-[#d4af37] uppercase">
            Customer Login
          </p>
        </Link>

        <div className="orbit-login-card w-full">
          <div className="orbit-login-card-glow" aria-hidden />
          <div className="relative z-10 p-7 sm:p-9">
            <Suspense fallback={<p className="text-sm text-white/50">Loading…</p>}>
              <CustomerLoginForm />
            </Suspense>
            <p className="mt-6 text-center text-xs text-white/45">
              Administrator?{" "}
              <Link href={routes.orbitLogin} className="text-[#60a5fa] hover:underline">
                Orbit Super Admin login
              </Link>
            </p>
          </div>
        </div>

        <footer className="mt-10 space-y-2 text-center text-[11px] text-white/40">
          <p>
            Developed by{" "}
            <a href="https://theglobalorbit.com" className="font-medium text-white/70 hover:text-[#d4af37]">
              Global Orbit
            </a>
          </p>
          <p>Enterprise Mail Platform · v{APP_VERSION}</p>
        </footer>
      </div>
    </div>
  );
}
