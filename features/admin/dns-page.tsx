"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loading } from "@/components/ui/loading";
import { adminFetch } from "@/lib/api/admin-fetch";
import type { AdminDomain, ApiResponse, PaginatedResult } from "@/types";

type DnsRow = {
  id: string;
  type: string;
  name: string;
  value: string;
  priority?: number | null;
  status: string;
  label?: string;
  publishType?: string;
};

function normalizeDnsRows(data: unknown): DnsRow[] {
  if (Array.isArray(data)) {
    return data.map((row, index) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id ?? `${r.type}-${r.name}-${index}`),
        type: String(r.type ?? "TXT"),
        name: String(r.name ?? r.host ?? ""),
        value: String(r.value ?? ""),
        priority: (r.priority as number | null | undefined) ?? null,
        status: String(r.status ?? "PENDING"),
        label: typeof r.label === "string" ? r.label : undefined,
        publishType: typeof r.publishType === "string" ? r.publishType : undefined,
      };
    });
  }

  if (data && typeof data === "object" && "flat" in data) {
    const flat = (data as { flat: unknown }).flat;
    if (!Array.isArray(flat)) return [];
    return flat.map((row, index) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id ?? `${r.purpose ?? r.type}-${r.host ?? r.name}-${index}`),
        type: String(r.publishType ?? r.type ?? "TXT"),
        name: String(r.host ?? r.name ?? ""),
        value: String(r.value ?? ""),
        priority: (r.priority as number | null | undefined) ?? null,
        status: String(r.status ?? "PENDING"),
        label: typeof r.label === "string" ? r.label : undefined,
        publishType: typeof r.publishType === "string" ? r.publishType : undefined,
      };
    });
  }

  return [];
}

export function DnsAdminPage() {
  const [domainId, setDomainId] = React.useState<string>("ALL");
  const [copied, setCopied] = React.useState<string | null>(null);

  const { data: domains } = useQuery({
    queryKey: ["admin-domains-options"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/domains?page=1&pageSize=100");
      const json = (await res.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
      if (!json.success) throw new Error("Failed");
      return json.data.items;
    },
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ["admin-dns", domainId],
    queryFn: async () => {
      const qs = domainId !== "ALL" ? `?domainId=${domainId}` : "";
      const res = await adminFetch(`/api/admin/dns${qs}`);
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!json.success) throw new Error("Failed to load DNS");
      return normalizeDnsRows(json.data);
    },
  });

  async function copyValue(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    toast.success("Copied to clipboard");
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function copyAll() {
    if (!records?.length) return;
    const text = records
      .map((r) => {
        const prio = r.priority != null && r.type.toUpperCase() === "MX" ? `\t${r.priority}` : "";
        return `${r.type}\t${r.name}\t${r.value}${prio}`;
      })
      .join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("All DNS records copied");
  }

  return (
    <AdminShell
      title="DNS Manager"
      description="A · MX · SPF · DKIM · DMARC · Autodiscover · Autoconfig"
      actions={
        <Button type="button" variant="outline" disabled={!records?.length} onClick={() => void copyAll()}>
          <Copy className="size-4" />
          Copy All DNS
        </Button>
      }
    >
      <div className="mb-4 max-w-sm">
        <Select value={domainId} onValueChange={setDomainId}>
          <SelectTrigger>
            <SelectValue placeholder="Filter domain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All domains</SelectItem>
            {(domains ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Loading label="Loading DNS records" /> : null}

      {records ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Copy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="text-xs font-semibold text-primary">
                    {record.label ?? record.type}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gold">{record.type}</TableCell>
                  <TableCell className="max-w-[180px] truncate font-mono text-xs">
                    {record.name}
                  </TableCell>
                  <TableCell className="max-w-[360px]">
                    <pre className="overflow-x-auto rounded-lg bg-black/40 p-2 font-mono text-[11px] text-muted-foreground">
                      {record.value}
                    </pre>
                  </TableCell>
                  <TableCell>
                    <StatusPill label={record.status} tone={statusToneFromValue(record.status)} />
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </AdminShell>
  );
}
