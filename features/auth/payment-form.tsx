"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pricingPlans } from "@/constants/marketing";
import {
  quotePlanPrice,
  SIGNUP_DRAFT_KEY,
  type BillingCycle,
  type PublicPlanKey,
  type SignupDraft,
} from "@/lib/billing/pricing";

export function PaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planKey = (searchParams.get("plan") ?? "starter") as PublicPlanKey;
  const interval = (searchParams.get("interval") ?? "MONTHLY") as BillingCycle;
  const [offlineOpen, setOfflineOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<SignupDraft | null>(null);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
      if (!raw) {
        router.replace("/signup");
        return;
      }
      setDraft(JSON.parse(raw) as SignupDraft);
    } catch {
      router.replace("/signup");
    }
  }, [router]);

  const planMeta = pricingPlans.find((p) => p.id === planKey);
  const quote = quotePlanPrice(planKey === "enterprise" ? "enterprise" : planKey, interval);

  function continuePayment() {
    // Payment gateway offline — never create account / activate / login.
    setOfflineOpen(true);
  }

  function closeAndReturn() {
    setOfflineOpen(false);
    try {
      sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
    } catch {
      /* ignore */
    }
    router.replace("/pricing");
  }

  return (
    <>
      <div className="glass-surface premium-shadow rounded-3xl p-8 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold">Checkout</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Review & continue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Confirm your plan details. Online payment is temporarily offline — our team will activate
          accounts manually.
        </p>

        <div className="mt-8 space-y-3 rounded-2xl border border-border/60 bg-background/40 p-5 text-sm">
          {draft ? (
            <>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{draft.name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Business</span>
                <span className="font-medium">{draft.businessName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{draft.email}</span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-border/50 pt-3">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{planMeta?.name ?? planKey}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Billing</span>
            <span className="font-medium">
              {interval === "MONTHLY" ? "Monthly" : interval === "YEARLY" ? "12 Months" : "24 Months"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-display text-xl font-semibold">
              {quote.contactSales
                ? "Custom"
                : quote.totalUsd != null
                  ? `$${quote.totalUsd}`
                  : "—"}
              {!quote.contactSales && interval === "MONTHLY" ? (
                <span className="text-xs font-normal text-muted-foreground"> /mo</span>
              ) : null}
            </span>
          </div>
          {quote.billingNote ? (
            <p className="text-[11px] text-gold/90">{quote.billingNote}</p>
          ) : null}
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-border/60 p-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-gold" />
            <span>Secure payment gateway integration is under maintenance.</span>
          </div>
        </div>

        <Button
          type="button"
          size="lg"
          className="mt-8 w-full gradient-blue border-0"
          onClick={continuePayment}
        >
          Continue Payment
        </Button>
      </div>

      <Dialog open={offlineOpen} onOpenChange={setOfflineOpen}>
        <DialogContent className="max-w-md border-white/10 bg-[#0a1220] text-white sm:rounded-2xl">
          <DialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
              <ShieldAlert className="size-5" />
            </div>
            <DialogTitle className="font-display text-xl">Payment System Temporarily Offline</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-white/65">
              Online payment integration is currently under maintenance.
              <br />
              <br />
              To activate your business email account please contact{" "}
              <a className="text-[#60a5fa] underline-offset-2 hover:underline" href="mailto:support@globalorbitmail.cloud">
                support@globalorbitmail.cloud
              </a>{" "}
              or{" "}
              <a className="text-[#60a5fa] underline-offset-2 hover:underline" href="mailto:sales@globalorbitmail.cloud">
                sales@globalorbitmail.cloud
              </a>
              .
              <br />
              <br />
              Thank you for choosing Global Orbit Mail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" className="w-full gradient-blue border-0" onClick={closeAndReturn}>
              Return to pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
