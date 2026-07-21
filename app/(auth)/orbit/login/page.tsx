import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { OrbitAdminLoginForm } from "@/features/auth/orbit-admin-login-form";
import { brand } from "@/config/brand";
import { APP_VERSION } from "@/config/version";

export const metadata: Metadata = {
  title: "Orbit — Super Admin",
  description: "GLOBAL ORBIT MAIL enterprise administrator console.",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="orbit-login-root relative min-h-dvh overflow-hidden text-white">
      <div className="orbit-login-aurora" aria-hidden />
      <div className="orbit-login-particles" aria-hidden />
      <div className="orbit-login-vignette" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-5 py-14">
        <div className="mb-8 flex w-full flex-col items-center text-center">
          <Link href="/" className="group inline-flex flex-col items-center" aria-label={brand.product}>
            <Image
              src={brand.assets.logo}
              alt={brand.product}
              width={240}
              height={72}
              priority
              className="h-auto w-[220px] drop-shadow-[0_12px_40px_rgba(47,111,237,0.35)] transition duration-500 group-hover:scale-[1.02] sm:w-[240px]"
            />
          </Link>
          <p className="mt-5 text-[13px] font-medium tracking-[0.28em] text-white/55 uppercase">
            Enterprise Mail Platform
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/25 bg-[#d4af37]/10 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-[#d4af37] uppercase">
            Super Admin
          </p>
        </div>

        <div className="orbit-login-card w-full">
          <div className="orbit-login-card-glow" aria-hidden />
          <div className="relative z-10 p-7 sm:p-9">
            <Suspense
              fallback={
                <div className="flex h-48 items-center justify-center text-sm text-white/50">
                  Loading secure console…
                </div>
              }
            >
              <OrbitAdminLoginForm />
            </Suspense>
          </div>
        </div>

        <footer className="mt-10 space-y-2 text-center text-[11px] text-white/40">
          <p>
            Developed by{" "}
            <a
              href="https://theglobalorbit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white/70 underline-offset-2 hover:text-[#d4af37] hover:underline"
            >
              Global Orbit
            </a>
          </p>
          <p>Enterprise Mail Platform · v{APP_VERSION}</p>
        </footer>
      </div>
    </div>
  );
}
