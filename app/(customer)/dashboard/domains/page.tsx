"use client";

import * as React from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { adminFetch } from "@/lib/api/admin-fetch";
import { Copy, Check } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

export default function CustomerDomainsPage() {
  const [step, setStep] = React.useState<Step>(1);
  const [domain, setDomain] = React.useState("");
  const [domainId, setDomainId] = React.useState<string | null>(null);
  const [records, setRecords] = React.useState<
    { id: string; type: string; name: string; value: string }[]
  >([]);
  const [copied, setCopied] = React.useState<string | null>(null);

  async function createDomain() {
    try {
      const res = await adminFetch("/api/customer/domains", {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Failed");
      setDomainId(json.data.id);
      setRecords(json.data.dnsRecords ?? []);
      toast.success("Domain created");
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function copyValue(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    toast.success("Copied");
    window.setTimeout(() => setCopied(null), 1200);
  }

  return (
    <CustomerShell title="Domains" description="Add domain → DNS → Verify → Mailbox">
      <div className="mb-6 flex flex-wrap gap-2">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div
            key={s}
            className={`rounded-full px-3 py-1 text-xs ${
              step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            Step {s}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="glass-surface max-w-lg space-y-4 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Add Domain</h2>
          <div className="space-y-2">
            <Label>Domain name</Label>
            <Input
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <Button type="button" onClick={createDomain}>
            Continue
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="glass-surface space-y-4 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Copy DNS records</h2>
          <p className="text-sm text-muted-foreground">
            Add these MX / SPF / DKIM / DMARC records at your DNS provider.
          </p>
          <ul className="space-y-3">
            {records.map((r) => (
              <li key={r.id} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-gold">{r.type}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => copyValue(r.id, r.value)}
                  >
                    {copied === r.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.name}</p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/30 p-2 text-[11px]">
                  {r.value}
                </pre>
              </li>
            ))}
          </ul>
          <Button type="button" onClick={() => setStep(3)}>
            I&apos;ve added the records
          </Button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="glass-surface max-w-lg space-y-4 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Verify DNS</h2>
          <p className="text-sm text-muted-foreground">
            Live DNS lookup is prepared for Phase 3B. Mark as pending verification for now.
          </p>
          <Button
            type="button"
            onClick={() => {
              toast.message("Verification queued", {
                description: "Architecture stub — no live DNS yet",
              });
              setStep(4);
            }}
          >
            Run verification
          </Button>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="glass-surface max-w-lg space-y-4 rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Create Mailbox</h2>
          <p className="text-sm text-muted-foreground">
            Domain {domain}
            {domainId ? ` (${domainId.slice(0, 8)}…)` : ""} is ready for mailboxes.
          </p>
          <Button asChild>
            <a href="/dashboard/mailboxes">Go to Mailboxes</a>
          </Button>
        </div>
      ) : null}
    </CustomerShell>
  );
}
