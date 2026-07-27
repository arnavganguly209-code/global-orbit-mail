"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDate, formatUsd } from "@/features/admin/admin-format";
import type { ApiResponse } from "@/types";

type Coupon = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffUsd: number | null;
  active: boolean;
  expiresAt: string | null;
  maxRedemptions: number | null;
  redemptions: number;
  createdAt: string;
};

type CouponForm = {
  code: string;
  percentOff: string;
  amountOffUsd: string;
  active: boolean;
  expiresAt: string;
  maxRedemptions: string;
};

const EMPTY_FORM: CouponForm = {
  code: "",
  percentOff: "",
  amountOffUsd: "",
  active: true,
  expiresAt: "",
  maxRedemptions: "",
};

function couponToForm(c: Coupon): CouponForm {
  return {
    code: c.code,
    percentOff: c.percentOff != null ? String(c.percentOff) : "",
    amountOffUsd: c.amountOffUsd != null ? String(c.amountOffUsd) : "",
    active: c.active,
    expiresAt: c.expiresAt ? c.expiresAt.slice(0, 16) : "",
    maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : "",
  };
}

async function fetchCoupons() {
  const res = await adminFetch("/api/admin/coupons");
  const json = (await res.json()) as ApiResponse<Coupon[]>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load coupons");
  return json.data;
}

export function CouponsAdminPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editCoupon, setEditCoupon] = React.useState<Coupon | null>(null);
  const [form, setForm] = React.useState<CouponForm>(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: fetchCoupons,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        code: form.code.trim(),
        active: form.active,
      };
      if (form.percentOff.trim()) payload.percentOff = Number(form.percentOff);
      if (form.amountOffUsd.trim()) payload.amountOffUsd = Number(form.amountOffUsd);
      if (form.expiresAt.trim()) payload.expiresAt = new Date(form.expiresAt).toISOString();
      if (form.maxRedemptions.trim()) payload.maxRedemptions = Number(form.maxRedemptions);

      const isEdit = editCoupon != null;
      const res = await adminFetch(
        isEdit ? `/api/admin/coupons/${editCoupon!.id}` : "/api/admin/coupons",
        { method: isEdit ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      const json = (await res.json()) as ApiResponse<Coupon>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Save failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success(editCoupon ? "Coupon updated" : "Coupon created");
      setDialogOpen(false);
      setEditCoupon(null);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditCoupon(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(coupon: Coupon) {
    setEditCoupon(coupon);
    setForm(couponToForm(coupon));
    setDialogOpen(true);
  }

  return (
    <AdminShell
      title="Coupons"
      description="Discount codes and redemption limits"
      actions={
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New coupon
        </Button>
      }
    >
      {isLoading ? <Loading label="Loading coupons…" /> : null}
      {!isLoading && data?.length === 0 ? (
        <EmptyState title="No coupons" description="Create a discount code for subscription activation." />
      ) : null}
      {data && data.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Redemptions</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.code}</TableCell>
                  <TableCell>
                    {c.percentOff != null
                      ? `${c.percentOff}% off`
                      : c.amountOffUsd != null
                        ? `${formatUsd(c.amountOffUsd)} off`
                        : "—"}
                  </TableCell>
                  <TableCell>
                    {c.redemptions}
                    {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                  </TableCell>
                  <TableCell>{formatDate(c.expiresAt)}</TableCell>
                  <TableCell>
                    <StatusPill label={c.active ? "Active" : "Inactive"} tone={c.active ? "success" : "neutral"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCoupon ? "Edit coupon" : "Create coupon"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="coupon-code">Code</Label>
              <Input
                id="coupon-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                disabled={editCoupon != null}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Percent off</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={form.percentOff}
                  onChange={(e) => setForm((f) => ({ ...f, percentOff: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Amount off USD</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amountOffUsd}
                  onChange={(e) => setForm((f) => ({ ...f, amountOffUsd: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Expires at</Label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Max redemptions</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.maxRedemptions}
                  onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v === true }))}
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.code.trim()}>
              {saveMutation.isPending ? "Saving…" : "Save coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
