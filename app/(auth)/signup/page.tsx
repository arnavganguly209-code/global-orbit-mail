import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CustomerSignupForm } from "@/features/auth/customer-signup-form";
import { brand } from "@/config/brand";
import { APP_VERSION } from "@/config/version";
import { quotePlanPrice, type PublicPlanKey } from "@/lib/billing/pricing";
import { pricingPlans } from "@/constants/marketing";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Register for GLOBAL ORBIT MAIL business email hosting.",
  robots: { index: false, follow: false },
};

function PlanSummary({ planKey }: { planKey: string | null }) {
  const key = (planKey === "business" || planKey === "enterprise" ? planKey : "starter") as PublicPlanKey;
  const plan = pricingPlans.find((p) => p.id === key);
  const quote = quotePlanPrice(key, "MONTHLY");
  return (
    <aside className="orbit-login-card hidden w-full max-w-sm lg:block">
      <div className="relative z-10 space-y-4 p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]">Selected plan</p>
        <h2 className="font-display text-2xl font-semibold">{plan?.name ?? "Business Starter"}</h2>
        <p className="text-sm text-white/60">{plan?.description}</p>
        <p className="font-display text-3xl font-semibold">
          {quote.contactSales ? "Custom" : quote.label}
          {!quote.contactSales ? <span className="text-sm font-normal text-white/50">/mo</span> : null}
        </p>
        <p className="text-xs text-white/45">
          Choose Monthly, 12 Months, or 24 Months on the next step. Online payment is temporarily
          offline — our team activates accounts manually.
        </p>
      </div>
    </aside>
  );
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="orbit-login-root relative min-h-dvh overflow-hidden text-white">
      <div className="orbit-login-aurora" aria-hidden />
      <div className="orbit-login-particles" aria-hidden />
      <div className="orbit-login-vignette" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center gap-8 px-5 py-14 lg:flex-row lg:items-stretch">
        <div className="flex w-full max-w-lg flex-col items-center">
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
              Customer Registration
            </p>
          </Link>

          <div className="orbit-login-card w-full">
            <div className="orbit-login-card-glow" aria-hidden />
            <div className="relative z-10 p-7 sm:p-9">
              <Suspense fallback={<p className="text-sm text-white/50">Loading form…</p>}>
                <CustomerSignupForm />
              </Suspense>
            </div>
          </div>
        </div>

        <PlanSummary planKey={params.plan ?? null} />
      </div>

      <footer className="relative z-10 pb-10 text-center text-[11px] text-white/40">
        Developed by{" "}
        <a href="https://theglobalorbit.com" className="text-white/70 hover:text-[#d4af37]">
          Global Orbit
        </a>
        {" · "}v{APP_VERSION}
      </footer>
    </div>
  );
}
