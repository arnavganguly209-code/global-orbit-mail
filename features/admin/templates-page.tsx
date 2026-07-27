"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { adminFetch } from "@/lib/api/admin-fetch";
import type { ApiResponse } from "@/types";

type TemplateCategory = "SYSTEM" | "BILLING" | "WELCOME" | "SECURITY" | "QUOTA" | "CUSTOM";

type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  variables: string[];
  active: boolean;
};

type TemplateForm = {
  key: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string;
  active: boolean;
};

const CATEGORIES: TemplateCategory[] = ["SYSTEM", "BILLING", "WELCOME", "SECURITY", "QUOTA", "CUSTOM"];

const EMPTY_FORM: TemplateForm = {
  key: "",
  name: "",
  category: "CUSTOM",
  subject: "",
  htmlBody: "",
  textBody: "",
  variables: "",
  active: true,
};

const SAMPLE_VARS: Record<string, string> = {
  displayName: "Jane Doe",
  email: "jane@example.com",
  companyName: "Acme Corp",
  webmailUrl: "https://mail.example.com",
  invoiceNumber: "INV-ABC123",
  amountUsd: "$49.00",
};

function templateToForm(t: EmailTemplate): TemplateForm {
  return {
    key: t.key,
    name: t.name,
    category: t.category,
    subject: t.subject,
    htmlBody: t.htmlBody,
    textBody: t.textBody ?? "",
    variables: (t.variables as string[]).join("\n"),
    active: t.active,
  };
}

async function fetchTemplates() {
  const res = await adminFetch("/api/admin/templates");
  const json = (await res.json()) as ApiResponse<EmailTemplate[]>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load templates");
  return json.data.map((t) => ({ ...t, variables: (t.variables as string[]) ?? [] }));
}

export function TemplatesAdminPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editTemplate, setEditTemplate] = React.useState<EmailTemplate | null>(null);
  const [form, setForm] = React.useState<TemplateForm>(EMPTY_FORM);
  const [deleteTemplate, setDeleteTemplate] = React.useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = React.useState<EmailTemplate | null>(null);
  const [previewVars, setPreviewVars] = React.useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = React.useState<{ subject: string; html: string; text?: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-templates"],
    queryFn: fetchTemplates,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isEdit = editTemplate != null;
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category,
        subject: form.subject.trim(),
        htmlBody: form.htmlBody,
        textBody: form.textBody.trim() || undefined,
        variables: form.variables
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        active: form.active,
      };
      if (!isEdit) payload.key = form.key.trim();

      const res = await adminFetch(
        isEdit ? `/api/admin/templates/${editTemplate!.id}` : "/api/admin/templates",
        { method: isEdit ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      const json = (await res.json()) as ApiResponse<EmailTemplate>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Save failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success(editTemplate ? "Template updated" : "Template created");
      setDialogOpen(false);
      setEditTemplate(null);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (tpl: EmailTemplate) => {
      const res = await adminFetch(`/api/admin/templates/${tpl.id}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<{ ok: boolean }>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Delete failed");
    },
    onSuccess: () => {
      toast.success("Template deleted");
      setDeleteTemplate(null);
      qc.invalidateQueries({ queryKey: ["admin-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!previewTemplate) throw new Error("No template selected");
      const res = await adminFetch(`/api/admin/templates/${previewTemplate.id}`, {
        method: "POST",
        body: JSON.stringify({ vars: previewVars }),
      });
      const json = (await res.json()) as ApiResponse<{ subject: string; html: string; text?: string }>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Preview failed");
      return json.data;
    },
    onSuccess: (result) => setPreviewResult(result),
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditTemplate(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(tpl: EmailTemplate) {
    setEditTemplate(tpl);
    setForm(templateToForm(tpl));
    setDialogOpen(true);
  }

  function openPreview(tpl: EmailTemplate) {
    const vars: Record<string, string> = {};
    for (const v of tpl.variables) {
      vars[v] = SAMPLE_VARS[v] ?? `{{${v}}}`;
    }
    setPreviewTemplate(tpl);
    setPreviewVars(vars);
    setPreviewResult(null);
  }

  return (
    <AdminShell
      title="Templates"
      description="Transactional and system email templates"
      actions={
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New template
        </Button>
      }
    >
      {isLoading ? <Loading label="Loading templates…" /> : null}
      {!isLoading && data?.length === 0 ? (
        <EmptyState title="No templates" description="Create an email template for system notifications." />
      ) : null}
      {data && data.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground">{tpl.key}</p>
                    </div>
                  </TableCell>
                  <TableCell>{tpl.category}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{tpl.subject}</TableCell>
                  <TableCell>
                    <StatusPill label={tpl.active ? "Active" : "Inactive"} tone={tpl.active ? "success" : "neutral"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openPreview(tpl)}>
                        <Eye className="size-3.5" />
                        Preview
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(tpl)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTemplate(tpl)}>
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Edit template" : "Create template"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {!editTemplate ? (
              <div className="grid gap-2">
                <Label htmlFor="tpl-key">Key</Label>
                <Input
                  id="tpl-key"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="welcome.mailbox"
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as TemplateCategory }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>HTML body</Label>
              <Textarea value={form.htmlBody} onChange={(e) => setForm((f) => ({ ...f, htmlBody: e.target.value }))} rows={6} />
            </div>
            <div className="grid gap-2">
              <Label>Text body (optional)</Label>
              <Textarea value={form.textBody} onChange={(e) => setForm((f) => ({ ...f, textBody: e.target.value }))} rows={3} />
            </div>
            <div className="grid gap-2">
              <Label>Variables (one per line, use {"{{var}}"} in body)</Label>
              <Textarea value={form.variables} onChange={(e) => setForm((f) => ({ ...f, variables: e.target.value }))} rows={2} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v === true }))} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewTemplate != null} onOpenChange={(o) => !o && setPreviewTemplate(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview — {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {Object.keys(previewVars).map((key) => (
              <div key={key} className="grid gap-2">
                <Label>{key}</Label>
                <Input
                  value={previewVars[key] ?? ""}
                  onChange={(e) => setPreviewVars((v) => ({ ...v, [key]: e.target.value }))}
                />
              </div>
            ))}
            <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
              {previewMutation.isPending ? "Rendering…" : "Render preview"}
            </Button>
            {previewResult ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                <p className="text-sm">
                  <span className="text-muted-foreground">Subject:</span> {previewResult.subject}
                </p>
                <div
                  className="prose prose-invert max-w-none rounded-lg bg-background/50 p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: previewResult.html }}
                />
                {previewResult.text ? (
                  <pre className="whitespace-pre-wrap rounded-lg bg-background/50 p-4 text-xs text-muted-foreground">
                    {previewResult.text}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTemplate != null} onOpenChange={(o) => !o && setDeleteTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleteTemplate?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTemplate(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTemplate && deleteMutation.mutate(deleteTemplate)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
