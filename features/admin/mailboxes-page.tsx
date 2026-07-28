"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Check,
  Copy,
  Eye,
  EyeOff,
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
import { Textarea } from "@/components/ui/textarea";
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
import { MailboxCreateFields } from "@/components/mailboxes/mailbox-create-fields";
import { cn } from "@/lib/utils";
import type { AdminDomain, AdminMailbox, ApiResponse, PaginatedResult } from "@/types";

type AliasRow = { id: string; address: string };
type ForwarderRow = { id: string; destination: string; keepCopy: boolean };

type EditFormState = {
  displayName: string;
  jobTitle: string;
  department: string;
  phone: string;
  website: string;
  company: string;
  replyTo: string;
  timezone: string;
  language: string;
  signatureHtml: string;
  signatureText: string;
  quotaMb: string;
  avatarUrl: string | null;
  vacationEnabled: boolean;
  vacationSubject: string;
  vacationBody: string;
  vacationExpiresAt: string;
};

type SigBuilderState = {
  name: string;
  title: string;
  phone: string;
  website: string;
};

type PasswordResetMode = "generate" | "set";

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSignatureHtml(fields: SigBuilderState, email: string): string {
  const lines: string[] = [];
  if (fields.name.trim()) {
    lines.push(`<strong>${escapeHtml(fields.name.trim())}</strong>`);
  }
  if (fields.title.trim()) {
    lines.push(`<div>${escapeHtml(fields.title.trim())}</div>`);
  }
  if (fields.phone.trim()) {
    lines.push(`<div>${escapeHtml(fields.phone.trim())}</div>`);
  }
  if (fields.website.trim()) {
    const site = fields.website.trim();
    const href = site.startsWith("http") ? site : `https://${site}`;
    lines.push(
      `<div><a href="${escapeHtml(href)}">${escapeHtml(site)}</a></div>`,
    );
  }
  lines.push(
    `<div><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>`,
  );
  return `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.45;color:#222">${lines.join("")}</div>`;
}

function emptyEditForm(): EditFormState {
  return {
    displayName: "",
    jobTitle: "",
    department: "",
    phone: "",
    website: "",
    company: "",
    replyTo: "",
    timezone: "",
    language: "",
    signatureHtml: "",
    signatureText: "",
    quotaMb: "2048",
    avatarUrl: null,
    vacationEnabled: false,
    vacationSubject: "",
    vacationBody: "",
    vacationExpiresAt: "",
  };
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function editFormFromMailbox(mailbox: AdminMailbox): EditFormState {
  return {
    displayName: mailbox.displayName ?? "",
    jobTitle: mailbox.jobTitle ?? "",
    department: mailbox.department ?? "",
    phone: mailbox.phone ?? "",
    website: mailbox.website ?? "",
    company: mailbox.company ?? "",
    replyTo: mailbox.replyTo ?? "",
    timezone: mailbox.timezone ?? "",
    language: mailbox.language ?? "",
    signatureHtml: mailbox.signatureHtml ?? "",
    signatureText: mailbox.signatureText ?? "",
    quotaMb: String(mailbox.quotaMb),
    avatarUrl: mailbox.avatarUrl,
    vacationEnabled: mailbox.vacationEnabled,
    vacationSubject: mailbox.vacationSubject ?? "",
    vacationBody: mailbox.vacationBody ?? "",
    vacationExpiresAt: toDatetimeLocal(mailbox.vacationExpiresAt),
  };
}

function sigBuilderFromMailbox(mailbox: AdminMailbox): SigBuilderState {
  return {
    name: mailbox.displayName ?? "",
    title: mailbox.jobTitle ?? "",
    phone: mailbox.phone ?? "",
    website: mailbox.website ?? "",
  };
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
  const [editForm, setEditForm] = React.useState<EditFormState>(emptyEditForm);
  const [sigBuilder, setSigBuilder] = React.useState<SigBuilderState>({
    name: "",
    title: "",
    phone: "",
    website: "",
  });
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
  const [resetMailbox, setResetMailbox] = React.useState<AdminMailbox | null>(null);
  const [resetMode, setResetMode] = React.useState<PasswordResetMode>("generate");
  const [resetPassword, setResetPassword] = React.useState("");
  const [revealedPassword, setRevealedPassword] = React.useState<string | null>(null);
  const [showRevealed, setShowRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

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
      toast.success("Mailbox Ready");
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
          displayName: editForm.displayName.trim() || null,
          jobTitle: editForm.jobTitle.trim() || null,
          department: editForm.department.trim() || null,
          phone: editForm.phone.trim() || null,
          website: editForm.website.trim() || null,
          company: editForm.company.trim() || null,
          replyTo: editForm.replyTo.trim() || null,
          timezone: editForm.timezone.trim() || null,
          language: editForm.language.trim() || null,
          signatureHtml: editForm.signatureHtml.trim() || null,
          signatureText: editForm.signatureText.trim() || null,
          avatarUrl: editForm.avatarUrl,
          vacationEnabled: editForm.vacationEnabled,
          vacationSubject: editForm.vacationSubject.trim() || null,
          vacationBody: editForm.vacationBody.trim() || null,
          vacationExpiresAt: fromDatetimeLocal(editForm.vacationExpiresAt),
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
    mutationFn: async () => {
      if (!resetMailbox) throw new Error("No mailbox selected");
      const body =
        resetMode === "generate"
          ? { generate: true, reveal: true, length: 20 }
          : { password: resetPassword, reveal: true };
      if (resetMode === "set" && resetPassword.length < 12) {
        throw new Error("Password must be at least 12 characters");
      }
      const res = await adminFetch(
        `/api/admin/mailboxes/${resetMailbox.id}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Reset failed");
      const data = json.data as {
        password?: string;
        generated?: boolean;
        reset?: boolean;
      };
      if (!data.password) {
        throw new Error("Password was reset but not returned for display");
      }
      return data;
    },
    onSuccess: (data) => {
      setRevealedPassword(data.password ?? null);
      setShowRevealed(true);
      setCopied(false);
      setResetPassword("");
      toast.success(
        data.generated
          ? "Password generated — copy it now; it cannot be shown again"
          : "Password set — copy it now; it cannot be shown again",
      );
    },
    onError: (e: Error) => toast.error(e.message),
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

  function openEdit(mailbox: AdminMailbox) {
    setEditMailbox(mailbox);
    setEditForm(editFormFromMailbox(mailbox));
    setSigBuilder(sigBuilderFromMailbox(mailbox));
  }

  function openPasswordReset(mailbox: AdminMailbox) {
    setResetMailbox(mailbox);
    setResetMode("generate");
    setResetPassword("");
    setRevealedPassword(null);
    setShowRevealed(false);
    setCopied(false);
  }

  function closePasswordReset() {
    setResetMailbox(null);
    setResetPassword("");
    setRevealedPassword(null);
    setShowRevealed(false);
    setCopied(false);
  }

  function applySignatureBuilder() {
    if (!editMailbox) return;
    const html = buildSignatureHtml(sigBuilder, editMailbox.email);
    const text = [
      sigBuilder.name.trim(),
      sigBuilder.title.trim(),
      sigBuilder.phone.trim(),
      sigBuilder.website.trim(),
      editMailbox.email,
    ]
      .filter(Boolean)
      .join("\n");
    setEditForm((f) => ({
      ...f,
      displayName: sigBuilder.name.trim() || f.displayName,
      jobTitle: sigBuilder.title.trim() || f.jobTitle,
      phone: sigBuilder.phone.trim() || f.phone,
      website: sigBuilder.website.trim() || f.website,
      signatureHtml: html,
      signatureText: text,
    }));
    toast.message("Signature applied to form — click Save to persist");
  }

  function onAvatarSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Avatar must be an image file");
      return;
    }
    if (file.size > 800_000) {
      toast.error("Logo must be under 800KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setEditForm((f) => ({ ...f, avatarUrl: result }));
      toast.message("Avatar loaded — click Save to persist");
    };
    reader.readAsDataURL(file);
  }

  async function copyRevealedPassword() {
    if (!revealedPassword) return;
    try {
      await navigator.clipboard.writeText(revealedPassword);
      setCopied(true);
      toast.success("Password copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
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
  const sigPreviewHtml = editMailbox
    ? editForm.signatureHtml.trim() ||
      buildSignatureHtml(sigBuilder, editMailbox.email)
    : "";

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
                        {mailbox.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mailbox.avatarUrl}
                            alt=""
                            className="size-9 shrink-0 rounded-full object-cover ring-1 ring-border"
                          />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                            {avatarInitial(mailbox)}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{mailbox.email}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {mailbox.displayName ?? "—"}
                            {mailbox.jobTitle ? ` · ${mailbox.jobTitle}` : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {mailbox.domainLogoDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mailbox.domainLogoDataUrl}
                            alt=""
                            className="size-5 shrink-0 rounded object-contain"
                          />
                        ) : null}
                        <span>{mailbox.domainName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{mailbox.quotaMb} MB</TableCell>
                    <TableCell className="tabular-nums text-sm">{mailbox.usedMb} MB</TableCell>
                    <TableCell className="tabular-nums text-sm">{remaining} MB</TableCell>
                    <TableCell>
                      <div className="min-w-[88px] space-y-1">
                        <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                          <span>
                            {mailbox.usedMb}/{mailbox.quotaMb} MB
                          </span>
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
                          onClick={() => openEdit(mailbox)}
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
                          onClick={() => openPasswordReset(mailbox)}
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

      <Dialog
        open={Boolean(editMailbox)}
        onOpenChange={(v) => {
          if (!v) setEditMailbox(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {editMailbox?.email}</DialogTitle>
            <DialogDescription>
              Profile, quota, and email signature for this mailbox.
            </DialogDescription>
          </DialogHeader>
          {editMailbox ? (
            <div className="space-y-6">
              {(editMailbox.domainLogoDataUrl || editMailbox.domainCompanyName) && (
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                  {editMailbox.domainLogoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={editMailbox.domainLogoDataUrl}
                      alt=""
                      className="max-h-10 max-w-[120px] object-contain"
                    />
                  ) : null}
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {editMailbox.domainCompanyName ?? editMailbox.domainName}
                    </p>
                    <p className="text-xs text-muted-foreground">Domain branding</p>
                  </div>
                </div>
              )}

              <section className="space-y-3 rounded-xl border border-border/60 p-4">
                <div>
                  <h3 className="text-sm font-medium">Company logo (email)</h3>
                  <p className="text-xs text-muted-foreground">
                    This logo is embedded at the top of every email this mailbox sends (Gmail body).
                    It does not replace Gmail&apos;s round sender icon — that requires BIMI + a verified mark
                    certificate. Also set Domain branding logo as a fallback for all mailboxes.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {editForm.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={editForm.avatarUrl}
                      alt=""
                      className="size-16 rounded-full object-cover ring-1 ring-border"
                    />
                  ) : (
                    <span className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-xl font-semibold text-primary">
                      {avatarInitial(editMailbox)}
                    </span>
                  )}
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => onAvatarSelected(e.target.files?.[0] ?? null)}
                    />
                    {editForm.avatarUrl ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditForm((f) => ({ ...f, avatarUrl: null }))}
                      >
                        Remove logo
                      </Button>
                    ) : null}
                  </div>
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Display name</Label>
                  <Input
                    value={editForm.displayName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, displayName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Job title</Label>
                  <Input
                    value={editForm.jobTitle}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, jobTitle: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, department: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={editForm.website}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, website: e.target.value }))
                    }
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
                    value={editForm.company}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, company: e.target.value }))
                    }
                    placeholder={editMailbox.domainCompanyName ?? undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reply-To</Label>
                  <Input
                    type="email"
                    value={editForm.replyTo}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, replyTo: e.target.value }))
                    }
                    placeholder={editMailbox.email}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quota (MB)</Label>
                  <Input
                    value={editForm.quotaMb}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, quotaMb: e.target.value }))
                    }
                  />
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    Using {editMailbox.usedMb} / {editMailbox.quotaMb} MB
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input
                    value={editForm.timezone}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, timezone: e.target.value }))
                    }
                    placeholder="America/New_York"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Input
                    value={editForm.language}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, language: e.target.value }))
                    }
                    placeholder="en"
                  />
                </div>
              </div>

              <section className="space-y-3 rounded-xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">Out of office</h3>
                    <p className="text-xs text-muted-foreground">
                      Auto-reply when this mailbox receives mail. Syncs to the mail server on save.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={editForm.vacationEnabled}
                      onCheckedChange={(v) =>
                        setEditForm((f) => ({ ...f, vacationEnabled: v === true }))
                      }
                    />
                    Enabled
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={editForm.vacationSubject}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, vacationSubject: e.target.value }))
                    }
                    placeholder="Out of office"
                    disabled={!editForm.vacationEnabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={editForm.vacationBody}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, vacationBody: e.target.value }))
                    }
                    rows={4}
                    placeholder="I am away and will respond when I return."
                    disabled={!editForm.vacationEnabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expires (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.vacationExpiresAt}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, vacationExpiresAt: e.target.value }))
                    }
                    disabled={!editForm.vacationEnabled}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to keep the auto-reply active until disabled manually.
                  </p>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-border/60 p-4">
                <div>
                  <h3 className="text-sm font-medium">Signature builder</h3>
                  <p className="text-xs text-muted-foreground">
                    Fill fields, apply to generate HTML, then save the mailbox.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={sigBuilder.name}
                      onChange={(e) =>
                        setSigBuilder((s) => ({ ...s, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={sigBuilder.title}
                      onChange={(e) =>
                        setSigBuilder((s) => ({ ...s, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={sigBuilder.phone}
                      onChange={(e) =>
                        setSigBuilder((s) => ({ ...s, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      value={sigBuilder.website}
                      onChange={(e) =>
                        setSigBuilder((s) => ({ ...s, website: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={applySignatureBuilder}>
                  Apply to signature
                </Button>
                {sigPreviewHtml ? (
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Preview
                    </p>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: sigPreviewHtml }}
                    />
                  </div>
                ) : null}
              </section>

              <div className="space-y-2">
                <Label>Signature HTML</Label>
                <Textarea
                  value={editForm.signatureHtml}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, signatureHtml: e.target.value }))
                  }
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Signature text (plain)</Label>
                <Textarea
                  value={editForm.signatureText}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, signatureText: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditMailbox(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resetMailbox)}
        onOpenChange={(v) => {
          if (!v) closePasswordReset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {resetMailbox?.email} — a new password is shown once after reset. Existing
              passwords cannot be recovered from the stored hash.
            </DialogDescription>
          </DialogHeader>

          {revealedPassword ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Copy this password now. Closing this dialog clears it from view.
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  type={showRevealed ? "text" : "password"}
                  value={revealedPassword}
                  className="font-mono"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title={showRevealed ? "Hide" : "Show"}
                  onClick={() => setShowRevealed((v) => !v)}
                >
                  {showRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Copy"
                  onClick={() => void copyRevealedPassword()}
                >
                  {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" onClick={closePasswordReset}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={resetMode === "generate" ? "default" : "outline"}
                  onClick={() => setResetMode("generate")}
                >
                  Generate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={resetMode === "set" ? "default" : "outline"}
                  onClick={() => setResetMode("set")}
                >
                  Set password
                </Button>
              </div>
              {resetMode === "set" ? (
                <div className="space-y-2">
                  <Label htmlFor="reset-password">New password</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="At least 12 characters"
                    autoComplete="new-password"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Generates a secure 20-character password and returns it once for you to
                  copy.
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closePasswordReset}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    resetMutation.isPending ||
                    (resetMode === "set" && resetPassword.length < 12)
                  }
                  onClick={() => resetMutation.mutate()}
                >
                  {resetMutation.isPending
                    ? "Resetting…"
                    : resetMode === "generate"
                      ? "Generate & reset"
                      : "Set & reset"}
                </Button>
              </DialogFooter>
            </div>
          )}
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
