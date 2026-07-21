"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "@/components/ui/search";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { adminFetch } from "@/lib/api/admin-fetch";
import {
  DnsSetupWizardScroll,
  type DnsWizardPayload,
} from "@/features/admin/dns-setup-wizard";
import { normalizeApexDomain } from "@/lib/dns/domain-name";
import type {
  AdminDomain,
  ApiResponse,
  PaginatedResult,
  VerificationTone,
} from "@/types";

type DnsInstructionPayload = DnsWizardPayload;

type DomainCreateResult = AdminDomain & {
  dns?: DnsInstructionPayload;
  alreadyExisted?: boolean;
  restored?: boolean;
  created?: boolean;
};

type VerifyReport = {
  domainId: string;
  domain: string;
  overall: string;
};

function dnsHealthTone(status: string): VerificationTone {
  const v = status.toUpperCase();
  if (v === "VERIFIED") return "success";
  if (["PENDING", "PARTIAL", "VERIFYING"].includes(v)) return "warning";
  if (["FAILED", "MISMATCH"].includes(v)) return "danger";
  return statusToneFromValue(status);
}

async function fetchGeneratedDns(domainId: string): Promise<DnsInstructionPayload> {
  const res = await adminFetch(`/api/admin/dns?domainId=${encodeURIComponent(domainId)}`);
  const json = (await res.json()) as ApiResponse<DnsInstructionPayload>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? "Failed to generate DNS records");
  }
  if (!json.data?.flat?.length && !json.data?.required?.length) {
    throw new Error("DNS generator returned no records");
  }
  return json.data;
}

async function fetchDomains(params: {
  page: number;
  search: string;
  status: string;
}) {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: "8",
    search: params.search,
  });
  if (params.status !== "ALL") qs.set("status", params.status);
  const res = await adminFetch(`/api/admin/domains?${qs}`);
  const json = (await res.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
  if (!json.success) throw new Error("Failed to load domains");
  return json.data;
}

export function DomainsAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editDomain, setEditDomain] = React.useState<AdminDomain | null>(null);
  const [domainName, setDomainName] = React.useState("");
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
  const [dnsDialogDomain, setDnsDialogDomain] = React.useState<AdminDomain | null>(null);
  const [dnsPayload, setDnsPayload] = React.useState<DnsInstructionPayload | null>(null);
  const [dnsLoading, setDnsLoading] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-domains", page, search, status],
    queryFn: () => fetchDomains({ page, search, status }),
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeApexDomain(domainName);
      setDomainName(normalized);
      const res = await adminFetch("/api/admin/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Unable to save domain. Please try again.");
      }
      return {
        data: json.data as DomainCreateResult,
        message: (json.message as string | undefined) ?? undefined,
      };
    },
    onSuccess: ({ data: created, message }) => {
      setCreateOpen(false);
      setDomainName("");
      qc.invalidateQueries({ queryKey: ["admin-domains"] });

      if (created.alreadyExisted) {
        toast.message(message ?? "This domain already exists in your account.");
      } else if (created.restored) {
        toast.success(message ?? "Domain restored successfully.");
      } else {
        toast.success(message ?? "Domain added successfully.");
      }

      if (created.dns) {
        setDnsDialogDomain(created);
        setDnsPayload(created.dns);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; body: Record<string, string> }) => {
      const res = await adminFetch(`/api/admin/domains/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Update failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Domain updated");
      setEditDomain(null);
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await adminFetch(`/api/admin/domains/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Delete failed");
    },
    onSuccess: () => {
      toast.success("Domain deleted");
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async (domainId: string) => {
      setVerifyingId(domainId);
      const res = await adminFetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Verification failed");
      return json.data as VerifyReport;
    },
    onSuccess: (report) => {
      toast.success(`DNS verification: ${report.overall}`, {
        description: report.domain,
      });
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
      qc.invalidateQueries({ queryKey: ["admin-dns"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setVerifyingId(null),
  });

  async function openDnsDialog(domain: AdminDomain) {
    setDnsDialogDomain(domain);
    setDnsPayload(null);
    setDnsLoading(true);
    try {
      const payload = await fetchGeneratedDns(domain.id);
      setDnsPayload(payload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate DNS");
      setDnsDialogDomain(null);
    } finally {
      setDnsLoading(false);
    }
  }

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminShell
      title="Domains"
      description="Domain lifecycle, SSL, DNS and mail status"
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-blue border-0">
              <Plus className="size-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Domain</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="domain-name">Domain name</Label>
              <Input
                id="domain-name"
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
              {domainName.trim() && normalizeApexDomain(domainName) !== domainName.trim().toLowerCase() ? (
                <p className="text-xs text-muted-foreground">
                  Will be saved as{" "}
                  <span className="font-mono text-foreground">
                    {normalizeApexDomain(domainName) || "…"}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  www and https are removed automatically. Stored as the root domain only.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                Create Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Search
          placeholder="Search domains…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          containerClassName="flex-1"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="VERIFYING">Verifying</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Loading label="Loading domains" /> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          title="No domains yet"
          description="Add your first domain to begin mailbox provisioning."
        />
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>SSL</TableHead>
                <TableHead>DNS health</TableHead>
                <TableHead>Mail</TableHead>
                <TableHead>Mailboxes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell>
                    <p className="font-medium tracking-tight">{domain.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {domain.id.slice(0, 8)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={domain.status}
                      tone={statusToneFromValue(domain.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={domain.sslStatus}
                      tone={statusToneFromValue(domain.sslStatus)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={domain.dnsStatus}
                      tone={dnsHealthTone(domain.dnsStatus)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={domain.mailStatus}
                      tone={statusToneFromValue(domain.mailStatus)}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">{domain.mailboxCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 border-primary/25 text-xs"
                        disabled={verifyingId === domain.id}
                        onClick={() => verifyMutation.mutate(domain.id)}
                      >
                        <ShieldCheck className="size-3.5 text-primary" />
                        {verifyingId === domain.id ? "…" : "Verify"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 border-gold/30 text-xs"
                        disabled={dnsLoading && dnsDialogDomain?.id === domain.id}
                        onClick={() => void openDnsDialog(domain)}
                      >
                        <Copy className="size-3.5 text-gold" />
                        {dnsLoading && dnsDialogDomain?.id === domain.id ? "…" : "DNS Setup"}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Edit"
                        onClick={() => setEditDomain(domain)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        onClick={() => {
                          if (window.confirm(`Delete domain ${domain.name}?`)) {
                            deleteMutation.mutate(domain.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border/60 p-4">
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </div>
      ) : null}

      <Dialog
        open={Boolean(dnsDialogDomain)}
        onOpenChange={(open) => {
          if (!open) {
            setDnsDialogDomain(null);
            setDnsPayload(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>DNS setup</DialogTitle>
            <DialogDescription>
              Google Workspace–style setup: add only the required mail records. Website DNS stays
              untouched.
            </DialogDescription>
          </DialogHeader>

          {dnsLoading ? <Loading label="Preparing DNS wizard" /> : null}

          {!dnsLoading && dnsPayload && dnsDialogDomain ? (
            <DnsSetupWizardScroll
              payload={dnsPayload}
              verifying={verifyingId === dnsDialogDomain.id}
              onVerify={() => verifyMutation.mutate(dnsDialogDomain.id)}
            />
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDnsDialogDomain(null);
                setDnsPayload(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editDomain)} onOpenChange={(o) => !o && setEditDomain(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Domain</DialogTitle>
          </DialogHeader>
          {editDomain ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["status", editDomain.status],
                  ["sslStatus", editDomain.sslStatus],
                  ["dnsStatus", editDomain.dnsStatus],
                  ["mailStatus", editDomain.mailStatus],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label>{key}</Label>
                  <Select
                    value={value}
                    onValueChange={(next) =>
                      setEditDomain({ ...editDomain, [key]: next } as AdminDomain)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {key === "status" &&
                        ["PENDING", "VERIFYING", "ACTIVE", "SUSPENDED", "FAILED"].map(
                          (opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ),
                        )}
                      {key === "sslStatus" &&
                        ["NONE", "PENDING", "ACTIVE", "EXPIRED", "FAILED"].map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      {key === "dnsStatus" &&
                        ["UNKNOWN", "PENDING", "PARTIAL", "VERIFIED", "FAILED"].map(
                          (opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ),
                        )}
                      {key === "mailStatus" &&
                        ["DISABLED", "PROVISIONING", "ACTIVE", "SUSPENDED", "ERROR"].map(
                          (opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ),
                        )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() =>
                editDomain &&
                updateMutation.mutate({
                  id: editDomain.id,
                  body: {
                    status: editDomain.status,
                    sslStatus: editDomain.sslStatus,
                    dnsStatus: editDomain.dnsStatus,
                    mailStatus: editDomain.mailStatus,
                  },
                })
              }
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
