"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Globe2, Plus, RefreshCw } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { customerFetch } from "@/lib/api/customer-fetch";
import { cn } from "@/lib/utils";
import type { AdminDomain, ApiResponse, DnsRecordView, PaginatedResult } from "@/types";

const WIZARD_STEPS = ["Add Domain", "Copy DNS", "Verify", "Create Mailbox"] as const;

async function fetchDomains() {
  const res = await customerFetch("/api/customer/domains?page=1&pageSize=50");
  const json = (await res.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
  if (!json.success) throw new Error("Failed to load domains");
  return json.data.items;
}

async function fetchDns(domainId: string) {
  const res = await customerFetch(`/api/customer/domains/${domainId}/dns`);
  const json = (await res.json()) as ApiResponse<DnsRecordView[]>;
  if (!json.success) throw new Error("Failed to load DNS records");
  return json.data;
}

function WizardTracker({ activeStep }: { activeStep: number }) {
  return (
    <div className="glass-surface mb-6 flex flex-wrap items-center gap-2 rounded-2xl p-4">
      {WIZARD_STEPS.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
              index <= activeStep
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {index + 1}
          </div>
          <span
            className={cn(
              "text-xs font-medium",
              index <= activeStep ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {step}
          </span>
          {index < WIZARD_STEPS.length - 1 ? (
            <div className="mx-2 h-px w-6 bg-border sm:w-10" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function CustomerDomainsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [domainName, setDomainName] = React.useState("");
  const [selectedDomainId, setSelectedDomainId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const { data: domains, isLoading } = useQuery({
    queryKey: ["customer-domains"],
    queryFn: fetchDomains,
  });

  const selectedDomain = domains?.find((d) => d.id === selectedDomainId) ?? domains?.[0] ?? null;

  const { data: dnsRecords, isFetching: dnsLoading } = useQuery({
    queryKey: ["customer-domain-dns", selectedDomain?.id],
    enabled: Boolean(selectedDomain?.id),
    queryFn: () => fetchDns(selectedDomain!.id),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await customerFetch("/api/customer/domains", {
        method: "POST",
        body: JSON.stringify({ name: domainName }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Create failed");
      return json.data as AdminDomain;
    },
    onSuccess: (domain) => {
      toast.success("Domain added — copy the DNS records to continue");
      setOpen(false);
      setDomainName("");
      setSelectedDomainId(domain.id);
      qc.invalidateQueries({ queryKey: ["customer-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copyValue(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    toast.success("Copied to clipboard");
    window.setTimeout(() => setCopied(null), 1500);
  }

  const activeStep = !domains?.length
    ? 0
    : selectedDomain?.status === "ACTIVE"
      ? 3
      : selectedDomain?.dnsStatus === "VERIFIED"
        ? 2
        : 1;

  return (
    <>
      <PageHeader
        title="Domains"
        description="Add Domain → Copy DNS → Verify → Create Mailbox"
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
                />
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

      <WizardTracker activeStep={activeStep} />

      {isLoading ? <Loading label="Loading domains" /> : null}

      {domains && domains.length === 0 ? (
        <EmptyState
          icon={<Globe2 className="size-5" />}
          title="No domains yet"
          description="Add your custom domain to start provisioning professional mailboxes."
        />
      ) : null}

      {domains && domains.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            {domains.map((domain) => (
              <button
                key={domain.id}
                type="button"
                onClick={() => setSelectedDomainId(domain.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-colors",
                  selectedDomain?.id === domain.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/60 bg-background/40 hover:border-primary/30",
                )}
              >
                <div>
                  <p className="text-sm font-medium">{domain.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {domain.mailboxCount} mailbox{domain.mailboxCount === 1 ? "" : "es"}
                  </p>
                </div>
                <StatusPill label={domain.status} tone={statusToneFromValue(domain.status)} />
              </button>
            ))}
          </div>

          <div className="glass-surface rounded-2xl p-5">
            {selectedDomain ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{selectedDomain.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      Add these records at your DNS provider, then verify.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        qc.invalidateQueries({ queryKey: ["customer-domain-dns", selectedDomain.id] })
                      }
                    >
                      <RefreshCw className="size-3.5" />
                      Verify
                    </Button>
                    <Button asChild size="sm" className="gradient-blue border-0">
                      <Link href={`/dashboard/mailboxes?domainId=${selectedDomain.id}`}>
                        Create Mailbox
                      </Link>
                    </Button>
                  </div>
                </div>

                {dnsLoading ? <Loading label="Loading DNS records" /> : null}

                {dnsRecords ? (
                  <div className="space-y-2">
                    {dnsRecords.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-xl border border-border/60 bg-background/40 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-gold">{record.type}</span>
                          <StatusPill label={record.status} tone={record.tone} />
                        </div>
                        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                          {record.name}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <pre className="flex-1 overflow-x-auto rounded-lg bg-black/40 p-2 font-mono text-[11px] text-muted-foreground">
                            {record.value}
                          </pre>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => copyValue(record.id, record.value)}
                          >
                            {copied === record.id ? (
                              <Check className="size-4 text-emerald-400" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
