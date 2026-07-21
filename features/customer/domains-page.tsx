"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { customerFetch } from "@/lib/api/customer-fetch";
import { normalizeApexDomain } from "@/lib/dns/domain-name";
import { cn } from "@/lib/utils";
import {
  DnsSetupWizardScroll,
  type DnsWizardPayload,
} from "@/features/admin/dns-setup-wizard";
import { FriendlyDomainBadge } from "@/components/domain/friendly-status";
import { DomainOnboardingProgress } from "@/components/domain/onboarding-progress";
import { getOnboardingStepIndex, isDomainReady } from "@/lib/domain/onboarding-status";
import type { AutoVerifyReport } from "@/hooks/use-dns-auto-verify";
import type { AdminDomain, ApiResponse, PaginatedResult } from "@/types";

async function fetchDomains() {
  const res = await customerFetch("/api/customer/domains?page=1&pageSize=50");
  const json = (await res.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
  if (!json.success) throw new Error("Failed to load domains");
  return json.data.items;
}

async function fetchDnsWizard(domainId: string): Promise<DnsWizardPayload> {
  const res = await customerFetch(`/api/customer/domains/${domainId}/dns`);
  const json = (await res.json()) as ApiResponse<DnsWizardPayload>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load DNS");
  if (!json.data?.flat?.length && !json.data?.required?.length) {
    throw new Error("DNS generator returned no records");
  }
  return json.data;
}

export function CustomerDomainsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [domainName, setDomainName] = React.useState("");
  const [selectedDomainId, setSelectedDomainId] = React.useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardDomain, setWizardDomain] = React.useState<AdminDomain | null>(null);
  const [wizardPayload, setWizardPayload] = React.useState<DnsWizardPayload | null>(null);
  const [wizardLoading, setWizardLoading] = React.useState(false);

  const { data: domains, isLoading } = useQuery({
    queryKey: ["customer-domains"],
    queryFn: fetchDomains,
    refetchInterval: (query) => {
      const items = query.state.data ?? [];
      const needsPoll = items.some((d) => !isDomainReady(d));
      return needsPoll ? 30_000 : 60_000;
    },
  });

  const selectedDomain = domains?.find((d) => d.id === selectedDomainId) ?? domains?.[0] ?? null;

  React.useEffect(() => {
    if (!selectedDomainId && domains?.[0]) {
      setSelectedDomainId(domains[0].id);
    }
  }, [domains, selectedDomainId]);

  async function openWizard(domain: AdminDomain) {
    setWizardDomain(domain);
    setWizardPayload(null);
    setWizardOpen(true);
    setWizardLoading(true);
    try {
      const payload = await fetchDnsWizard(domain.id);
      setWizardPayload(payload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open DNS setup");
      setWizardOpen(false);
      setWizardDomain(null);
    } finally {
      setWizardLoading(false);
    }
  }

  async function runVerify(domainId: string): Promise<AutoVerifyReport> {
    const res = await customerFetch(`/api/customer/domains/${domainId}/verify`, {
      method: "POST",
      body: JSON.stringify({ domainId }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message ?? "Unable to check DNS right now.");
    }
    const report = json.data as AutoVerifyReport;
    await qc.invalidateQueries({ queryKey: ["customer-domains"] });
    if (report.ready) {
      setWizardDomain((prev) =>
        prev && prev.id === domainId
          ? { ...prev, status: "ACTIVE", dnsStatus: "VERIFIED", mailStatus: "ACTIVE" }
          : prev,
      );
    }
    return report;
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeApexDomain(domainName);
      setDomainName(normalized);
      const res = await customerFetch("/api/customer/domains", {
        method: "POST",
        body: JSON.stringify({ name: normalized }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Unable to save domain. Please try again.");
      }
      return {
        data: json.data as AdminDomain & {
          alreadyExisted?: boolean;
          restored?: boolean;
          dns?: DnsWizardPayload;
        },
        message: (json.message as string | undefined) ?? undefined,
      };
    },
    onSuccess: async ({ data: domain, message }) => {
      if (domain.alreadyExisted) {
        toast.message(message ?? "This domain already exists in your account.");
      } else {
        toast.success("✓ Domain Connected");
      }
      setOpen(false);
      setDomainName("");
      setSelectedDomainId(domain.id);
      await qc.invalidateQueries({ queryKey: ["customer-domains"] });

      if (domain.dns) {
        setWizardDomain(domain);
        setWizardPayload(domain.dns);
        setWizardOpen(true);
      } else {
        await openWizard(domain);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeStep = selectedDomain
    ? getOnboardingStepIndex(selectedDomain)
    : 0;

  return (
    <>
      <PageHeader
        title="Domains"
        description="Connect your domain in minutes — we verify DNS automatically"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-blue border-0">
                <Plus className="size-4" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a domain</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="customer-domain-name">Domain name</Label>
                <Input
                  id="customer-domain-name"
                  placeholder="example.com"
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  onBlur={() => {
                    const normalized = normalizeApexDomain(domainName);
                    if (normalized && normalized !== domainName.trim()) {
                      setDomainName(normalized);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  www and https are removed automatically.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !domainName}
                >
                  Add Domain
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {selectedDomain ? (
        <div className="glass-surface mb-6 rounded-2xl p-4">
          <DomainOnboardingProgress activeStep={activeStep} />
        </div>
      ) : null}

      {isLoading ? <Loading label="Loading domains" /> : null}

      {domains && domains.length === 0 ? (
        <EmptyState
          icon={<Globe2 className="size-5" />}
          title="No domains yet"
          description="Add your custom domain to start creating professional mailboxes."
        />
      ) : null}

      {domains && domains.length > 0 ? (
        <div className="grid gap-4">
          {domains.map((domain) => {
            const ready = isDomainReady(domain);
            return (
              <div
                key={domain.id}
                className={cn(
                  "glass-surface flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between",
                  selectedDomain?.id === domain.id && "ring-1 ring-primary/40",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSelectedDomainId(domain.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold tracking-tight">
                      {domain.name}
                    </p>
                    <FriendlyDomainBadge domain={domain} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ready
                      ? domain.mailboxCount > 0
                        ? `${domain.mailboxCount} mailbox${domain.mailboxCount === 1 ? "" : "es"}`
                        : "Ready — create your first mailbox"
                      : "Add DNS records to finish setup"}
                  </p>
                </button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void openWizard(domain)}
                  >
                    {ready ? "View DNS" : "Continue DNS Setup"}
                  </Button>
                  {ready ? (
                    <Button asChild size="sm" className="gradient-blue border-0">
                      <Link href={`/dashboard/mailboxes?domainId=${domain.id}`}>
                        Create First Mailbox
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <Dialog
        open={wizardOpen}
        onOpenChange={(next) => {
          setWizardOpen(next);
          if (!next) {
            setWizardDomain(null);
            setWizardPayload(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect domain</DialogTitle>
            <DialogDescription>
              Add required mail DNS. We verify automatically — no manual Verify button.
            </DialogDescription>
          </DialogHeader>
          {wizardLoading ? <Loading label="Preparing DNS wizard" /> : null}
          {!wizardLoading && wizardPayload && wizardDomain ? (
            <DnsSetupWizardScroll
              domainId={wizardDomain.id}
              domainMeta={wizardDomain}
              payload={wizardPayload}
              mailboxHref={`/dashboard/mailboxes?domainId=${wizardDomain.id}`}
              verifyFn={runVerify}
              onDomainRefresh={() => {
                qc.invalidateQueries({ queryKey: ["customer-domains"] });
              }}
              onReady={() => {
                qc.invalidateQueries({ queryKey: ["customer-domains"] });
              }}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWizardOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
