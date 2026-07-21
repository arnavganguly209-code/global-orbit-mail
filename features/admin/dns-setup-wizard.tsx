"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatDnsRecordsForClipboard,
  formatSingleDnsRecordForClipboard,
} from "@/lib/dns/clipboard";
import { DomainOnboardingProgress } from "@/components/domain/onboarding-progress";
import { DomainAdvancedDetails } from "@/components/domain/friendly-status";
import { getFriendlyDomainStatus } from "@/lib/domain/onboarding-status";
import { useDnsAutoVerify, type AutoVerifyReport } from "@/hooks/use-dns-auto-verify";
import { cn } from "@/lib/utils";

export type DnsWizardRecord = {
  type: string;
  publishType: string;
  host: string;
  fqdn?: string;
  value: string;
  priority: number | null;
  ttl: number;
  status: string;
  purpose: string;
  label: string;
  alreadyPublished?: boolean;
  tier?: "required" | "advanced";
};

export type DnsWizardPayload = {
  domain: string;
  title?: string;
  notice?: string;
  required?: DnsWizardRecord[];
  advanced?: DnsWizardRecord[];
  flat: DnsWizardRecord[];
  spfMerge?: {
    existing: string;
    recommended: string;
    message: string;
  } | null;
  wizard?: {
    requiredCount?: number;
    advancedCount?: number;
    verificationEnabled?: boolean;
  };
};

function DnsRecordCard({
  record,
  onCopy,
}: {
  record: DnsWizardRecord;
  onCopy: (record: DnsWizardRecord) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {record.label}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {record.publishType}
              {record.priority != null ? ` · Priority ${record.priority}` : ""}
              {record.ttl ? ` · TTL ${record.ttl}` : ""}
            </span>
            {record.alreadyPublished ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-600">
                <CheckCircle2 className="size-3" />
                Detected
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Host <span className="font-mono text-foreground">{record.host}</span>
            {record.fqdn ? (
              <>
                {" "}
                · <span className="font-mono">{record.fqdn}</span>
              </>
            ) : null}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => onCopy(record)}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
      </div>
      <div className="rounded-xl bg-muted/40 px-3 py-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Value
        </p>
        <p className="break-all font-mono text-xs leading-relaxed text-foreground">
          {record.value}
        </p>
      </div>
    </div>
  );
}

export function DnsSetupWizard({
  domainId,
  domainMeta,
  payload,
  mailboxHref,
  verifyFn,
  onReady,
  onDomainRefresh,
}: {
  domainId: string;
  domainMeta: {
    status: string;
    dnsStatus: string;
    mailStatus: string;
    mailboxCount?: number;
  };
  payload: DnsWizardPayload;
  mailboxHref: string;
  verifyFn: (domainId: string) => Promise<AutoVerifyReport>;
  onReady?: (report: AutoVerifyReport) => void;
  onDomainRefresh?: () => void;
}) {
  const [dnsSubmitted, setDnsSubmitted] = React.useState(false);
  const [localReady, setLocalReady] = React.useState(
    () =>
      domainMeta.status === "ACTIVE" ||
      domainMeta.dnsStatus === "VERIFIED",
  );

  const auto = useDnsAutoVerify({
    domainId,
    enabled: dnsSubmitted && !localReady,
    verify: verifyFn,
    onReport: (report) => {
      onDomainRefresh?.();
      if (report.ready) {
        setLocalReady(true);
        toast.success("DNS verified — your domain is ready");
        onReady?.(report);
      }
    },
    onReady: (report) => {
      setLocalReady(true);
      onReady?.(report);
    },
  });

  const required = payload.required?.length
    ? payload.required
    : payload.flat.filter((r) =>
        ["mx", "spf", "mail_a", "verification"].includes(r.purpose),
      );
  const advanced = payload.advanced?.length
    ? payload.advanced
    : payload.flat.filter(
        (r) => !["mx", "spf", "mail_a", "verification"].includes(r.purpose),
      );

  const friendly = getFriendlyDomainStatus({
    ...domainMeta,
    ready: localReady,
    dnsCheckStarted: dnsSubmitted || auto.checking,
    requiredPassed: auto.lastReport?.requiredPassed,
    requiredTotal: auto.lastReport?.requiredTotal ?? 3,
    waitingFor: auto.lastReport?.waitingFor,
  });

  async function copyOne(record: DnsWizardRecord) {
    try {
      await navigator.clipboard.writeText(formatSingleDnsRecordForClipboard(record));
      toast.success(`${record.label} copied`);
    } catch {
      toast.error("Could not copy record");
    }
  }

  async function copyRequired() {
    try {
      await navigator.clipboard.writeText(
        formatDnsRecordsForClipboard(required, payload.domain),
      );
      toast.success("Required DNS copied");
    } catch {
      toast.error("Could not copy DNS records");
    }
  }

  async function copyMergeSpf() {
    if (!payload.spfMerge) return;
    try {
      await navigator.clipboard.writeText(payload.spfMerge.recommended);
      toast.success("Merged SPF value copied");
    } catch {
      toast.error("Could not copy SPF");
    }
  }

  function handleAddedDns() {
    setDnsSubmitted(true);
    toast.message("Checking DNS automatically", {
      description: "No action required — we will keep checking in the background.",
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Sparkles className="size-3.5" />
              Domain Connected
            </p>
            <p className="mt-1 font-display text-lg tracking-tight text-foreground">
              {payload.domain}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {localReady
                ? "Your domain is ready for professional email."
                : "Add the required mail DNS records. Website DNS stays untouched."}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
              friendly.tone === "success" &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              friendly.tone === "warning" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
              friendly.tone === "danger" &&
                "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
            )}
          >
            {localReady ? "✓ Ready" : friendly.label}
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-border/50 bg-background/60 p-3">
          <DomainOnboardingProgress
            activeStep={localReady ? 3 : dnsSubmitted ? 2 : 1}
          />
        </div>
      </div>

      {localReady ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            ✓ Ready
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            DNS looks good. Create your first mailbox to start sending and receiving email.
          </p>
          <Button asChild className="mt-4 gradient-blue border-0 gap-2">
            <Link href={mailboxHref}>
              <Mail className="size-4" />
              Create First Mailbox
            </Link>
          </Button>
        </div>
      ) : null}

      {!localReady && dnsSubmitted ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            {auto.checking ? (
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-amber-600" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-600" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">{friendly.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                DNS is propagating. This usually takes a few minutes. We&apos;ll continue checking
                automatically. No action required.
              </p>
              {auto.attempt > 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Automatic check #{auto.attempt}
                  {auto.lastReport?.waitingFor
                    ? ` · Waiting for ${auto.lastReport.waitingFor}`
                    : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!localReady ? (
        <>
          {payload.spfMerge ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-medium text-foreground">SPF merge recommended</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {payload.spfMerge.message}
              </p>
              <div className="mt-3 grid gap-2">
                <div className="rounded-xl bg-background/70 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Existing
                  </p>
                  <p className="break-all font-mono text-[11px]">{payload.spfMerge.existing}</p>
                </div>
                <div className="rounded-xl bg-background/70 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Recommended merge
                  </p>
                  <p className="break-all font-mono text-[11px]">{payload.spfMerge.recommended}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 h-8 gap-1.5 text-xs"
                onClick={() => void copyMergeSpf()}
              >
                <Copy className="size-3.5" />
                Copy merged SPF
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-tight">Required DNS</h3>
              <span className="text-[11px] text-muted-foreground">Minimum to go live</span>
            </div>
            <div className="space-y-3">
              {required.map((record) => (
                <DnsRecordCard
                  key={`req-${record.purpose}-${record.host}`}
                  record={record}
                  onCopy={(r) => void copyOne(r)}
                />
              ))}
            </div>
          </div>

          {advanced.length > 0 ? (
            <Accordion type="single" collapsible className="rounded-2xl border border-border/70 px-4">
              <AccordionItem value="advanced" className="border-none">
                <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                  Advanced Records
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Optional for better deliverability and client autoconfig. Not required to start
                    receiving mail.
                  </p>
                  <div className="space-y-3">
                    {advanced.map((record) => (
                      <DnsRecordCard
                        key={`adv-${record.purpose}-${record.host}`}
                        record={record}
                        onCopy={(r) => void copyOne(r)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void copyRequired()}
            >
              <Copy className="size-4" />
              Copy Required DNS
            </Button>
            <Button
              type="button"
              className="gradient-blue border-0 gap-2"
              disabled={dnsSubmitted && auto.checking}
              onClick={handleAddedDns}
            >
              {dnsSubmitted && auto.checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {dnsSubmitted ? "Checking DNS..." : "I've Added DNS"}
            </Button>
          </div>
        </>
      ) : null}

      <DomainAdvancedDetails
        domain={{
          ...domainMeta,
          ready: localReady,
          dnsCheckStarted: dnsSubmitted,
          requiredPassed: auto.lastReport?.requiredPassed,
          requiredTotal: auto.lastReport?.requiredTotal,
          waitingFor: auto.lastReport?.waitingFor,
        }}
      />
    </div>
  );
}

export function DnsSetupWizardScroll(
  props: React.ComponentProps<typeof DnsSetupWizard>,
) {
  return (
    <ScrollArea className="max-h-[70vh] pr-3">
      <DnsSetupWizard {...props} />
    </ScrollArea>
  );
}
