import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Loading } from "@/components/ui/loading";
import { PaymentForm } from "@/features/auth/payment-form";

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

export default function SignupPaymentPage() {
  return (
    <AuroraBackground className="min-h-dvh">
      <div className="noise-overlay absolute inset-0" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" aria-label="Home">
            <BrandLogo href={null} priority width={220} className="w-[180px] sm:w-[220px]" />
          </Link>
          <ThemeToggle />
        </div>
        <Suspense fallback={<Loading label="Loading order summary" />}>
          <PaymentForm />
        </Suspense>
      </div>
    </AuroraBackground>
  );
}
