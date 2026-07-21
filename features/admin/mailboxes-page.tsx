"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Forward,
  KeyRound,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { adminFetch } from "@/lib/api/admin-fetch";
import { MailboxCreateFields } from "@/components/mailboxes/mailbox-create-fields";
import { cn } from "@/lib/utils";
import type { AdminDomain, AdminMailbox, ApiResponse, PaginatedResult } from "@/types";

type AliasRow = { id: string; address: string };
type ForwarderRow = { id: string; destination: string; keepCopy: boolean };

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

function usageBarClass(percent: number) {
  if (percent >= 90) return "bg-red-400";
  if (percent >= 75) return "bg-amber-300";
  return "bg-primary";
}

function avatarInitial(mailbox: AdminMailbox) {
  const source = mailbox.displayName?.trim() || mailbox.localPart || mailbox.email;
  return source.charAt(0).toUpperCase();
}

export function MailboxesAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [editMailbox, setEditMailbox] = React.useState<AdminMailbox | null>(null);
  const [manageMailbox, setManageMailbox] = React.useState<AdminMailbox | null>(null);
  const [aliasInput, setAliasInput] = React.useState("");
  const [forwarderInput, setForwarderInput] = React.useState("");
  const [form, setForm] = React.useState({
    localPart: "",
    domainId: "",
    displayName: "",
    quotaMb: "2048",
    password: "",
  });
  const [editForm, setEditForm] = React.useState({
    displayName: "",
    quotaMb: "2048",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-mailboxes", page, search],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: "8",
        search,
      });
      const res = await adminFetch(`/api/admin/mailboxes?${qs}`);
      const json = (await res.json()) as ApiResponse<PaginatedResult<AdminMailbox>>;
      if (!json.success) throw new Error("Failed to load mailboxes");
      return json.data;
    },
  });

  const items = React.useMemo(() => {
    const list = data?.items ?? [];
    if (status === "ALL") return list;
    return list.filter((m) => m.status === status);
  }, [data?.items, status]);

  React.useEffect(() => {
    setSelected(new Set());
  }, [page, search, status, data?.items]);

  const { data: domainsData, isLoading: domainsLoading, refetch: refetchDomains } = useQuery({
    queryKey: ["admin-domains-options"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/domains?mailboxable=1");
      const json = (await res.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
      if (!json.success) throw new Error("Failed to load domains");
      return json.data.items ?? [];
    },
  });

  React.useEffect(() => {
    if (open) void refetchDomains();
  }, [open, refetchDomains]);

  const { data: aliases = [], isLoading: aliasesLoading } = useQuery({
    queryKey: ["admin-mailbox-aliases", manageMailbox?.id],
    enabled: Boolean(manageMailbox?.id),
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/mailboxes/${manageMailbox!.id}/aliases`);
      const json = (await res.json()) as ApiResponse<AliasRow[]>;
      if (!json.success) throw new Error("Failed to load aliases");
      return json.data;
    },
  });

  const { data: forwarders = [], isLoading: forwardersLoading } = useQuery({
    queryKey: ["admin-mailbox-forwarders", manageMailbox?.id],
    enabled: Boolean(manageMailbox?.id),
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/mailboxes/${manageMailbox!.id}/forwarders`);
      const json = (await res.json()) as ApiResponse<ForwarderRow[]>;
      if (!json.success) throw new Error("Failed to load forwarders");
      return json.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/admin/mailboxes", {
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
      qc.invalidateQueries({ queryKey: ["admin-domains-options"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editMailbox) return;
      const res = await adminFetch(`/api/admin/mailboxes/${editMailbox.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editForm.displayName || null,
          quotaMb: Number(editForm.quotaMb),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Update failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Mailbox updated");
      setEditMailbox(null);
      qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { id: string; action: "suspend" | "activate" }) => {
      const res = await adminFetch(`/api/admin/mailboxes/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: payload.action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Status update failed");
    },
    onSuccess: () => {
      toast.success("Mailbox status updated");
      qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      const password = window.prompt(
        "Enter a new mailbox password (min 12 characters)",
      );
      if (!password) throw new Error("Password reset cancelled");
      if (password.length < 12) throw new Error("Password must be at least 12 characters");
      const res = await adminFetch(`/api/admin/mailboxes/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Reset failed");
    },
    onSuccess: () => toast.success("Password reset stored (VPS provisioning deferred)"),
    onError: (e: Error) => {
      if (e.message !== "Password reset cancelled") toast.error(e.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await adminFetch(`/api/admin/mailboxes/${id}`, { method: "DELETE" });
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

  const addAliasMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch(`/api/admin/mailboxes/${manageMailbox!.id}/aliases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: aliasInput }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Alias failed");
    },
    onSuccess: () => {
      toast.success("Alias added");
      setAliasInput("");
      qc.invalidateQueries({ queryKey: ["admin-mailbox-aliases"] });
      qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAliasMutation = useMutation({
    mutationFn: async (aliasId: string) => {
      const res = await adminFetch(
        `/api/admin/mailboxes/${manageMailbox!.id}/aliases/${aliasId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Delete failed");
    },
    onSuccess: () => {
      toast.success("Alias removed");
      qc.invalidateQueries({ queryKey: ["admin-mailbox-aliases"] });
      qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addForwarderMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch(`/api/admin/mailboxes/${manageMailbox!.id}/forwarders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: forwarderInput, keepCopy: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Forwarder failed");
    },
    onSuccess: () => {
      toast.success("Forwarder added");
      setForwarderInput("");
      qc.invalidateQueries({ queryKey: ["admin-mailbox-forwarders"] });
      qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeForwarderMutation = useMutation({
    mutationFn: async (forwarderId: string) => {
      const res = await adminFetch(
        `/api/admin/mailboxes/${manageMailbox!.id}/forwarders/${forwarderId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Delete failed");
    },
    onSuccess: () => {
      toast.success("Forwarder removed");
      qc.invalidateQueries({ queryKey: ["admin-mailbox-forwarders"] });
      qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allVisibleSelected =
    items.length > 0 && items.every((m) => selected.has(m.id));

  function toggleAllVisible(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.map((m) => m.id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function runBulkSuspend() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Disable (suspend) ${ids.length} mailbox(es)?`)) return;
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const res = await adminFetch(`/api/admin/mailboxes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "suspend" }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message ?? "Failed");
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkBusy(false);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
    if (failed === 0) toast.success(`Disabled ${ok} mailbox(es)`);
    else toast.error(`Disabled ${ok}, failed ${failed}`);
  }

  async function runBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Permanently delete ${ids.length} mailbox(es)?`)) return;
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const res = await adminFetch(`/api/admin/mailboxes/${id}`, { method: "DELETE" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message ?? "Failed");
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkBusy(false);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
    qc.invalidateQueries({ queryKey: ["admin-domains"] });
    if (failed === 0) toast.success(`Deleted ${ok} mailbox(es)`);
    else toast.error(`Deleted ${ok}, failed ${failed}`);
  }

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
            <MailboxCreateFields
              form={form}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              domains={domainsData ?? []}
              domainsLoading={domainsLoading}
              domainsHref="/orbit/domains"
            />
            <DialogFooter>
              <Button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  !form.domainId ||
                  !form.localPart ||
                  form.password.length < 12 ||
                  !(domainsData ?? []).length
                }
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Search
          placeholder="Search mailboxes…"
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
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="DISABLED">Disabled</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="mr-auto text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selected.size}</span> selected
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bulkBusy}
            onClick={() => void runBulkSuspend()}
          >
            <PauseCircle className="size-3.5" />
            Bulk Disable
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={bulkBusy}
            onClick={() => void runBulkDelete()}
          >
            <Trash2 className="size-3.5" />
            Bulk Delete
          </Button>
        </div>
      ) : null}

      {isLoading ? <Loading label="Loading mailboxes" /> : null}
      {!isLoading && items.length === 0 ? (
        <EmptyState title="No mailboxes" description="Create a mailbox on an existing domain." />
      ) : null}

      {items.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(v) => toggleAllVisible(v === true)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Mailbox</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((mailbox) => {
                const remaining =
                  mailbox.remainingMb ??
                  Math.max(0, mailbox.quotaMb - mailbox.usedMb);
                const usage =
                  mailbox.usagePercent ??
                  (mailbox.quotaMb > 0
                    ? Math.round((mailbox.usedMb / mailbox.quotaMb) * 100)
                    : 0);
                return (
                  <TableRow key={mailbox.id} data-state={selected.has(mailbox.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(mailbox.id)}
                        onCheckedChange={(v) => toggleOne(mailbox.id, v === true)}
                        aria-label={`Select ${mailbox.email}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                          {avatarInitial(mailbox)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{mailbox.email}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {mailbox.displayName ?? "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mailbox.domainName}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{mailbox.quotaMb} MB</TableCell>
                    <TableCell className="tabular-nums text-sm">{mailbox.usedMb} MB</TableCell>
                    <TableCell className="tabular-nums text-sm">{remaining} MB</TableCell>
                    <TableCell>
                      <div className="min-w-[88px] space-y-1">
                        <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                          <span>{usage}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all", usageBarClass(usage))}
                            style={{ width: `${Math.min(100, Math.max(0, usage))}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={mailbox.status}
                        tone={statusToneFromValue(mailbox.status)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatRelative(mailbox.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Edit"
                          onClick={() => {
                            setEditMailbox(mailbox);
                            setEditForm({
                              displayName: mailbox.displayName ?? "",
                              quotaMb: String(mailbox.quotaMb),
                            });
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Aliases & forwarders"
                          onClick={() => setManageMailbox(mailbox)}
                        >
                          <AtSign className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Suspend"
                          onClick={() =>
                            statusMutation.mutate({ id: mailbox.id, action: "suspend" })
                          }
                        >
                          <PauseCircle className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Activate"
                          onClick={() =>
                            statusMutation.mutate({ id: mailbox.id, action: "activate" })
                          }
                        >
                          <PlayCircle className="size-4 text-emerald-400" />
                        </Button>
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
                          onClick={() => {
                            if (window.confirm(`Delete mailbox ${mailbox.email}?`)) {
                              deleteMutation.mutate(mailbox.id);
                            }
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="border-t border-border/60 p-4">
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(editMailbox)} onOpenChange={(v) => !v && setEditMailbox(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editMailbox?.email}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input
                value={editForm.displayName}
                onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Quota (MB)</Label>
              <Input
                value={editForm.quotaMb}
                onChange={(e) => setEditForm((f) => ({ ...f, quotaMb: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => editMutation.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(manageMailbox)}
        onOpenChange={(v) => {
          if (!v) {
            setManageMailbox(null);
            setAliasInput("");
            setForwarderInput("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aliases & Forwarders · {manageMailbox?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <AtSign className="size-4" /> Aliases
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="alias@domain.com"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                />
                <Button type="button" onClick={() => addAliasMutation.mutate()}>
                  Add
                </Button>
              </div>
              {aliasesLoading ? <Loading label="Loading aliases" /> : null}
              <ul className="space-y-2">
                {aliases.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-xs">{a.address}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeAliasMutation.mutate(a.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </li>
                ))}
                {!aliasesLoading && aliases.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No aliases yet.</p>
                ) : null}
              </ul>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <Forward className="size-4" /> Forwarders
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="forward@elsewhere.com"
                  value={forwarderInput}
                  onChange={(e) => setForwarderInput(e.target.value)}
                />
                <Button type="button" onClick={() => addForwarderMutation.mutate()}>
                  Add
                </Button>
              </div>
              {forwardersLoading ? <Loading label="Loading forwarders" /> : null}
              <ul className="space-y-2">
                {forwarders.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-xs">{f.destination}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeForwarderMutation.mutate(f.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </li>
                ))}
                {!forwardersLoading && forwarders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No forwarders yet.</p>
                ) : null}
              </ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
