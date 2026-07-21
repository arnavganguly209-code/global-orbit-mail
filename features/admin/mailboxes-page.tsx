"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "@/components/ui/search";
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
import type { AdminDomain, AdminMailbox, ApiResponse, PaginatedResult } from "@/types";

export function MailboxesAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    localPart: "",
    domainId: "",
    displayName: "",
    quotaMb: "2048",
    password: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-mailboxes", page, search],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: "8",
        search,
      });
      const res = await fetch(`/api/admin/mailboxes?${qs}`);
      const json = (await res.json()) as ApiResponse<PaginatedResult<AdminMailbox>>;
      if (!json.success) throw new Error("Failed to load mailboxes");
      return json.data;
    },
  });

  const { data: domainsData } = useQuery({
    queryKey: ["admin-domains-options"],
    queryFn: async () => {
      const res = await fetch("/api/admin/domains?page=1&pageSize=100");
      const json = (await res.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
      if (!json.success) throw new Error("Failed");
      return json.data.items;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localPart: form.localPart,
          domainId: form.domainId,
          displayName: form.displayName || undefined,
          quotaMb: Number(form.quotaMb),
          password: form.password,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Create failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Mailbox created");
      setOpen(false);
      setForm({
        localPart: "",
        domainId: "",
        displayName: "",
        quotaMb: "2048",
        password: "",
      });
      qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/mailboxes/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "TemporaryPass123!" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Reset failed");
    },
    onSuccess: () => toast.success("Password reset queued (VPS provisioning deferred)"),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/mailboxes/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Delete failed");
    },
    onSuccess: () => {
      toast.success("Mailbox deleted");
      qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminShell
      title="Mailboxes"
      description="Mailbox provisioning, quotas, aliases and forwarders"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-blue border-0">
              <Plus className="size-4" />
              Create Mailbox
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Mailbox</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Local part</Label>
                <Input
                  value={form.localPart}
                  onChange={(e) => setForm((f) => ({ ...f, localPart: e.target.value }))}
                  placeholder="name"
                />
              </div>
              <div className="space-y-2">
                <Label>Domain</Label>
                <Select
                  value={form.domainId}
                  onValueChange={(domainId) => setForm((f) => ({ ...f, domainId }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {(domainsData ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display name</Label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Quota (MB)</Label>
                <Input
                  value={form.quotaMb}
                  onChange={(e) => setForm((f) => ({ ...f, quotaMb: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => createMutation.mutate()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Search
        className="mb-4"
        containerClassName="mb-4 max-w-md"
        placeholder="Search mailboxes…"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
      />

      {isLoading ? <Loading label="Loading mailboxes" /> : null}
      {data && data.items.length === 0 ? (
        <EmptyState title="No mailboxes" description="Create a mailbox on an existing domain." />
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Aliases</TableHead>
                <TableHead>Forwarders</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((mailbox) => (
                <TableRow key={mailbox.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{mailbox.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {mailbox.displayName ?? "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={mailbox.status}
                      tone={statusToneFromValue(mailbox.status)}
                    />
                  </TableCell>
                  <TableCell>
                    {mailbox.usedMb} / {mailbox.quotaMb} MB
                  </TableCell>
                  <TableCell>{mailbox.aliasCount}</TableCell>
                  <TableCell>{mailbox.forwarderCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Reset password"
                        onClick={() => resetMutation.mutate(mailbox.id)}
                      >
                        <KeyRound className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(mailbox.id)}
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
    </AdminShell>
  );
}
