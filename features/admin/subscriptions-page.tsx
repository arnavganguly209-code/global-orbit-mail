"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
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
import { formatDate, pageCount } from "@/features/admin/admin-format";
import type { ApiResponse, PaginatedResult } from "@/types";

type BillingInterval = "MONTHLY" | "YEARLY" | "TWO_YEAR";

type SubscriptionRow = {
  id: string;
  status: string;
  interval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: { id: string; key: string; name: string };
  organization: { id: string; name: string; slug: string } | null;
};

type PlanOption = { id: string; key: string; name: string };

const INTERVAL_OPTIONS: { value: BillingInterval; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "TWO_YEAR", label: "Two year" },
];

const PAGE_SIZE = 10;

async function fetchSubscriptions(page: number, status: string) {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status !== "ALL") qs.set("status", status);
  const res = await adminFetch(`/api/admin/subscriptions?${qs}`);
  const json = (await res.json()) as ApiResponse<PaginatedResult<SubscriptionRow> & { items: SubscriptionRow[] }>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load subscriptions");
  return json.data;
}

async function fetchPlans() {
  const res = await adminFetch("/api/admin/plans");
  const json = (await res.json()) as ApiResponse<PlanOption[]>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load plans");
  return json.data;
}

export function SubscriptionsAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [orgId, setOrgId] = React.useState("");
  const [planKey, setPlanKey] = React.useState("");
  const [interval, setInterval] = React.useState<BillingInterval>("MONTHLY");
  const [couponCode, setCouponCode] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions", page, statusFilter],
    queryFn: () => fetchSubscriptions(page, statusFilter),
  });

  const { data: plans } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: fetchPlans,
  });

  React.useEffect(() => {
    if (plans?.length && !planKey) setPlanKey(plans[0].key);
  }, [plans, planKey]);

  const activateMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {
        organizationId: orgId.trim(),
        planKey,
        interval,
      };
      if (couponCode.trim()) payload.couponCode = couponCode.trim();
      const res = await adminFetch("/api/admin/subscriptions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Activation failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Subscription activated");
      setActivateOpen(false);
      setOrgId("");
      setCouponCode("");
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPages = pageCount(data?.total ?? 0, PAGE_SIZE);

  return (
    <AdminShell
      title="Subscriptions"
      description="Customer subscription lifecycle"
      actions={
        <Button onClick={() => setActivateOpen(true)}>
          <Plus className="size-4" />
          Activate subscription
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAST_DUE">Past due</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
            <SelectItem value="TRIALING">Trialing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Loading label="Loading subscriptions…" /> : null}
      {!isLoading && data?.items.length === 0 ? (
        <EmptyState title="No subscriptions" description="Activate a subscription for an organization." />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="space-y-4">
          <div className="glass-surface overflow-hidden rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period end</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{sub.organization?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{sub.organization?.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>{sub.plan.name}</TableCell>
                    <TableCell>{sub.interval}</TableCell>
                    <TableCell>
                      <StatusPill label={sub.status} tone={statusToneFromValue(sub.status)} uppercase />
                    </TableCell>
                    <TableCell>{formatDate(sub.currentPeriodEnd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate subscription</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="sub-org">Organization ID</Label>
              <Input
                id="sub-org"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="UUID"
              />
            </div>
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select value={planKey} onValueChange={setPlanKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {(plans ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.key}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Interval</Label>
              <Select value={interval} onValueChange={(v) => setInterval(v as BillingInterval)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-coupon">Coupon code (optional)</Label>
              <Input
                id="sub-coupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="SAVE20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending || !orgId.trim() || !planKey}
            >
              {activateMutation.isPending ? "Activating…" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
