"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StatusPill } from "@/components/admin/status-pill";
import {
  getFriendlyDomainStatus,
  type DomainOnboardingInput,
} from "@/lib/domain/onboarding-status";

export function FriendlyDomainBadge({
  domain,
  className,
}: {
  domain: DomainOnboardingInput;
  className?: string;
}) {
  const friendly = getFriendlyDomainStatus(domain);
  return <StatusPill label={friendly.label} tone={friendly.tone} className={className} />;
}

export function DomainAdvancedDetails({ domain }: { domain: DomainOnboardingInput }) {
  const friendly = getFriendlyDomainStatus(domain);
  return (
    <Accordion type="single" collapsible className="rounded-xl border border-border/60 px-3">
      <AccordionItem value="advanced" className="border-none">
        <AccordionTrigger className="py-2 text-xs font-medium text-muted-foreground hover:no-underline">
          Advanced Details
        </AccordionTrigger>
        <AccordionContent>
          <dl className="grid gap-2 text-[11px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Domain status</dt>
              <dd className="font-mono">{friendly.technical.status}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">DNS status</dt>
              <dd className="font-mono">{friendly.technical.dnsStatus}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Mail status</dt>
              <dd className="font-mono">{friendly.technical.mailStatus}</dd>
            </div>
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
