"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/api/admin-fetch";

function PaymentInner() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = params.get("plan") ?? "starter";
  const interval = params.get("interval") ?? "monthly";
  const [pending, setPending] = useState(false);

  async function activate() {
    setPending(true);
    try {
      const res = await adminFetch("/api/customer/billing/activate", {
        method: "POST",
        body: JSON.stringify({ planKey: plan, interval }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Payment failed");
      toast.success("Subscription activated");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="glass-surface mx-auto w-full max-w-md space-y-6 rounded-3xl p-8 text-center">
      <BrandLogo href="/" width={160} className="mx-auto" />
      <h1 className="font-display text-2xl font-semibold">Complete payment</h1>
      <p className="text-sm text-muted-foreground">
        Plan <span className="text-foreground">{plan}</span> ·{" "}
        <span className="text-foreground">{interval}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Payment provider integration is architecture-ready. This step activates your subscription
        in PostgreSQL so the dashboard unlocks.
      </p>
      <Button className="gradient-blue w-full border-0" disabled={pending} onClick={activate}>
        {pending ? "Activating…" : "Activate subscription"}
      </Button>
      <Button asChild variant="ghost">
        <Link href="/signup/plan">Back to plans</Link>
      </Button>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 -z-10 mesh-gradient" />
      <Suspense>
        <PaymentInner />
      </Suspense>
    </div>
  );
}
