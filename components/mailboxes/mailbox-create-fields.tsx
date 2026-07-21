"use client";

import * as React from "react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { AdminDomain } from "@/types";

export function MailboxCreateFields({
  form,
  onChange,
  domains,
  domainsLoading,
  domainsHref,
}: {
  form: {
    localPart: string;
    domainId: string;
    displayName: string;
    quotaMb: string;
    password: string;
  };
  onChange: (patch: Partial<typeof form>) => void;
  domains: AdminDomain[];
  domainsLoading?: boolean;
  domainsHref: string;
}) {
  const selected = domains.find((d) => d.id === form.domainId) ?? null;
  const local = form.localPart.trim().toLowerCase() || "name";
  const preview = selected ? `${local}@${selected.name}` : null;

  React.useEffect(() => {
    if (domains.length === 0) return;
    if (!form.domainId) {
      onChange({ domainId: domains[0]!.id });
      return;
    }
    if (!domains.some((d) => d.id === form.domainId)) {
      onChange({ domainId: domains[0]!.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when domain list or selection changes
  }, [domains, form.domainId]);

  return (
    <div className="grid gap-3">
      <div className="space-y-2">
        <Label htmlFor="mailbox-local">Local part</Label>
        <Input
          id="mailbox-local"
          value={form.localPart}
          onChange={(e) => onChange({ localPart: e.target.value.replace(/\s/g, "") })}
          placeholder="name"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label>Domain</Label>
        {domainsLoading ? (
          <p className="text-xs text-muted-foreground">Loading domains…</p>
        ) : domains.length === 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm">
            <p className="font-medium text-foreground">No active domains found.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Please connect a domain first.
            </p>
            <Link
              href={domainsHref}
              className="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Go to Domains
            </Link>
          </div>
        ) : (
          <Select
            value={form.domainId || undefined}
            onValueChange={(domainId) => onChange({ domainId })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select domain" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[500]">
              {domains.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {preview ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Mailbox preview
          </p>
          <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{preview}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="mailbox-display">Display name</Label>
        <Input
          id="mailbox-display"
          value={form.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mailbox-quota">Quota (MB)</Label>
        <Input
          id="mailbox-quota"
          value={form.quotaMb}
          onChange={(e) => onChange({ quotaMb: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mailbox-password">Password</Label>
        <Input
          id="mailbox-password"
          type="password"
          value={form.password}
          onChange={(e) => onChange({ password: e.target.value })}
          placeholder="At least 12 characters"
          autoComplete="new-password"
        />
      </div>
    </div>
  );
}
