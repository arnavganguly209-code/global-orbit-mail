"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { ONBOARDING_STEPS } from "@/lib/domain/onboarding-status";

export function DomainOnboardingProgress({
  activeStep,
  className,
}: {
  /** 0 = connected only; 1 = DNS setup; 2 = verifying; 3 = mailbox ready */
  activeStep: number;
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-3 sm:grid-cols-4", className)}>
      {ONBOARDING_STEPS.map((step, index) => {
        const complete = index < activeStep || activeStep >= 3;
        const current = index === Math.min(activeStep, 3) && activeStep < 3;
        return (
          <li key={step.id} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                complete
                  ? "bg-emerald-500 text-white"
                  : current
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {complete ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-xs font-medium leading-snug",
                  complete || current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {index === 0 && complete ? "✓ Domain Connected" : step.label}
              </p>
              <p className="text-[10px] text-muted-foreground">Step {index + 1}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
