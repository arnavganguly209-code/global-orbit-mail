"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import type { AdminDomain, ApiResponse, PaginatedResult } from "@/types";

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

  const { data, isLoading } = useQuery({
    queryKey: ["admin-domains", page, search, status],
    queryFn: () => fetchDomains({ page, search, status }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/admin/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: domainName }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Create failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Domain created");
      setCreateOpen(false);
      setDomainName("");
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
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
              />
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
                <TableHead>DNS</TableHead>
                <TableHead>Mail</TableHead>
                <TableHead>Mailboxes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium">{domain.name}</TableCell>
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
                      tone={statusToneFromValue(domain.dnsStatus)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={domain.mailStatus}
                      tone={statusToneFromValue(domain.mailStatus)}
                    />
                  </TableCell>
                  <TableCell>{domain.mailboxCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditDomain(domain)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
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
