"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { formatUsd } from "@/features/admin/admin-format";
import type { ApiResponse } from "@/types";

type Plan = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number | null;
  twoYearPriceUsd: number | null;
  storageGb: number;
  mailboxLimit: number;
  domainLimit: number;
  features: string[];
  isPublic: boolean;
  contactSales: boolean;
  sortOrder: number;
};

type PlanForm = {
  key: string;
  name: string;
  description: string;
  monthlyPriceUsd: string;
  yearlyPriceUsd: string;
  twoYearPriceUsd: string;
  storageGb: string;
  mailboxLimit: string;
  domainLimit: string;
  features: string;
  isPublic: boolean;
  contactSales: boolean;
  sortOrder: string;
};

const EMPTY_FORM: PlanForm = {
  key: "",
  name: "",
  description: "",
  monthlyPriceUsd: "0",
  yearlyPriceUsd: "",
  twoYearPriceUsd: "",
  storageGb: "10",
  mailboxLimit: "5",
  domainLimit: "1",
  features: "",
  isPublic: true,
  contactSales: false,
  sortOrder: "0",
};

function planToForm(p: Plan): PlanForm {
  return {
    key: p.key,
    name: p.name,
    description: p.description ?? "",
    monthlyPriceUsd: String(p.monthlyPriceUsd),
    yearlyPriceUsd: p.yearlyPriceUsd != null ? String(p.yearlyPriceUsd) : "",
    twoYearPriceUsd: p.twoYearPriceUsd != null ? String(p.twoYearPriceUsd) : "",
    storageGb: String(p.storageGb),
    mailboxLimit: String(p.mailboxLimit),
    domainLimit: String(p.domainLimit),
    features: p.features.join("\n"),
    isPublic: p.isPublic,
    contactSales: p.contactSales,
    sortOrder: String(p.sortOrder),
  };
}

function formToPayload(form: PlanForm, isEdit: boolean) {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    monthlyPriceUsd: Number(form.monthlyPriceUsd),
    yearlyPriceUsd: form.yearlyPriceUsd.trim() ? Number(form.yearlyPriceUsd) : undefined,
    twoYearPriceUsd: form.twoYearPriceUsd.trim() ? Number(form.twoYearPriceUsd) : undefined,
    storageGb: Number(form.storageGb),
    mailboxLimit: Number(form.mailboxLimit),
    domainLimit: Number(form.domainLimit),
    features: form.features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    isPublic: form.isPublic,
    contactSales: form.contactSales,
    sortOrder: Number(form.sortOrder) || 0,
  };
  if (!isEdit) payload.key = form.key.trim();
  return payload;
}

async function fetchPlans() {
  const res = await adminFetch("/api/admin/plans");
  const json = (await res.json()) as ApiResponse<Plan[]>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load plans");
  return json.data;
}

export function PlansAdminPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editPlan, setEditPlan] = React.useState<Plan | null>(null);
  const [form, setForm] = React.useState<PlanForm>(EMPTY_FORM);
  const [deletePlan, setDeletePlan] = React.useState<Plan | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: fetchPlans,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isEdit = editPlan != null;
      const payload = formToPayload(form, isEdit);
      const res = await adminFetch(
        isEdit ? `/api/admin/plans/${editPlan!.id}` : "/api/admin/plans",
        { method: isEdit ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      const json = (await res.json()) as ApiResponse<Plan>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Save failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success(editPlan ? "Plan updated" : "Plan created");
      setDialogOpen(false);
      setEditPlan(null);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      const res = await adminFetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<{ ok: boolean }>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Delete failed");
    },
    onSuccess: () => {
      toast.success("Plan deleted");
      setDeletePlan(null);
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditPlan(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditPlan(plan);
    setForm(planToForm(plan));
    setDialogOpen(true);
  }

  return (
    <AdminShell
      title="Plans"
      description="Subscription plans and entitlements"
      actions={
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New plan
        </Button>
      }
    >
      {isLoading ? <Loading label="Loading plans…" /> : null}
      {!isLoading && data?.length === 0 ? (
        <EmptyState title="No plans" description="Create your first subscription plan." />
      ) : null}
      {data && data.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.key}</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatUsd(plan.monthlyPriceUsd)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {plan.mailboxLimit} mailboxes · {plan.storageGb} GB · {plan.domainLimit} domain
                    {plan.domainLimit !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {plan.isPublic ? <StatusPill label="Public" tone="success" /> : <StatusPill label="Hidden" tone="neutral" />}
                      {plan.contactSales ? <StatusPill label="Contact sales" tone="warning" /> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeletePlan(plan)}>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editPlan ? "Edit plan" : "Create plan"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {!editPlan ? (
              <div className="grid gap-2">
                <Label htmlFor="plan-key">Key</Label>
                <Input
                  id="plan-key"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="starter"
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-desc">Description</Label>
              <Textarea
                id="plan-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Monthly USD</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthlyPriceUsd}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyPriceUsd: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Yearly USD</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.yearlyPriceUsd}
                  onChange={(e) => setForm((f) => ({ ...f, yearlyPriceUsd: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>2-year USD</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.twoYearPriceUsd}
                  onChange={(e) => setForm((f) => ({ ...f, twoYearPriceUsd: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Storage GB</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.storageGb}
                  onChange={(e) => setForm((f) => ({ ...f, storageGb: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Mailboxes</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.mailboxLimit}
                  onChange={(e) => setForm((f) => ({ ...f, mailboxLimit: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Domains</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.domainLimit}
                  onChange={(e) => setForm((f) => ({ ...f, domainLimit: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Features (one per line)</Label>
              <Textarea
                value={form.features}
                onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.isPublic}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v === true }))}
                />
                Public
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.contactSales}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, contactSales: v === true }))}
                />
                Contact sales
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletePlan != null} onOpenChange={(o) => !o && setDeletePlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete plan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deletePlan?.name}</strong>? Plans with active subscriptions cannot be removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePlan(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletePlan && deleteMutation.mutate(deletePlan)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
