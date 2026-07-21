"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
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
import type { ApiResponse, PaginatedResult } from "@/types";

type PlanKey = "starter" | "business" | "enterprise";
type BillingInterval = "MONTHLY" | "YEARLY" | "TWO_YEAR";

type AdminCustomer = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationStatus: string | null;
  planKey: string | null;
  planName: string | null;
  interval: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
};

const PLAN_OPTIONS: { value: PlanKey; label: string }[] = [
  { value: "starter", label: "Starter" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
];

const INTERVAL_OPTIONS: { value: BillingInterval; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "TWO_YEAR", label: "Two year" },
];

const EMPTY_CREATE = {
  name: "",
  email: "",
  company: "",
  password: "",
  planKey: "starter" as PlanKey,
  interval: "MONTHLY" as BillingInterval,
  activate: true,
  storageGb: "",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatInterval(interval: string | null) {
  if (!interval) return "—";
  const match = INTERVAL_OPTIONS.find((o) => o.value === interval);
  return match?.label ?? interval;
}

async function fetchCustomers(params: { page: number; search: string }) {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: "8",
    search: params.search,
  });
  const res = await adminFetch(`/api/admin/customers?${qs}`);
  const json = (await res.json()) as ApiResponse<PaginatedResult<AdminCustomer>>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load customers");
  return json.data;
}

export function CustomersAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_CREATE);
  const [assignCustomer, setAssignCustomer] = React.useState<AdminCustomer | null>(null);
  const [assignPlanKey, setAssignPlanKey] = React.useState<PlanKey>("starter");
  const [assignInterval, setAssignInterval] = React.useState<BillingInterval>("MONTHLY");
  const [extendCustomer, setExtendCustomer] = React.useState<AdminCustomer | null>(null);
  const [extendMonths, setExtendMonths] = React.useState("1");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers", page, search],
    queryFn: () => fetchCustomers({ page, search }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        password: form.password,
        planKey: form.planKey,
        interval: form.interval,
        activate: form.activate,
      };
      if (form.storageGb.trim()) {
        payload.storageGb = Number(form.storageGb);
      }
      const res = await adminFetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Create failed");
      return json;
    },
    onSuccess: (json) => {
      toast.success(json.message ?? "Customer created");
      setCreateOpen(false);
      setForm(EMPTY_CREATE);
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      body: Record<string, unknown>;
      successMessage: string;
    }) => {
      const res = await adminFetch(`/api/admin/customers/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Update failed");
      return { ...json, successMessage: payload.successMessage };
    },
    onSuccess: (json) => {
      toast.success(json.successMessage ?? json.message ?? "Customer updated");
      setAssignCustomer(null);
      setExtendCustomer(null);
      setExtendMonths("1");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminShell
      title="Customers"
      description="Customer accounts, plans, and subscription lifecycle"
      actions={
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setForm(EMPTY_CREATE);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gradient-blue border-0">
              <Plus className="size-4" />
              Create Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Customer</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customer-name">Name</Label>
                <Input
                  id="customer-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@company.com"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customer-company">Company</Label>
                <Input
                  id="customer-company"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customer-password">Password</Label>
                <Input
                  id="customer-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 12 characters"
                />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={form.planKey}
                  onValueChange={(planKey) =>
                    setForm((f) => ({ ...f, planKey: planKey as PlanKey }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Interval</Label>
                <Select
                  value={form.interval}
                  onValueChange={(interval) =>
                    setForm((f) => ({ ...f, interval: interval as BillingInterval }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customer-storage">Storage (GB, optional)</Label>
                <Input
                  id="customer-storage"
                  type="number"
                  min={1}
                  value={form.storageGb}
                  onChange={(e) => setForm((f) => ({ ...f, storageGb: e.target.value }))}
                  placeholder="Leave blank for plan default"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  id="customer-activate"
                  checked={form.activate}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, activate: v === true }))
                  }
                />
                <Label htmlFor="customer-activate" className="font-normal">
                  Activate immediately
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Search
          placeholder="Search customers…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          containerClassName="flex-1"
        />
      </div>

      {isLoading ? <Loading label="Loading customers" /> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Create a customer account to assign a plan and activate billing."
        />
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Org status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <p className="font-medium tracking-tight">{customer.name ?? "—"}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {customer.id.slice(0, 8)}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{customer.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.organizationName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {customer.planName ?? customer.planKey ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatInterval(customer.interval)}
                  </TableCell>
                  <TableCell>
                    {customer.subscriptionStatus ? (
                      <StatusPill
                        label={customer.subscriptionStatus}
                        tone={statusToneFromValue(customer.subscriptionStatus)}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {customer.organizationStatus ? (
                      <StatusPill
                        label={customer.organizationStatus}
                        tone={statusToneFromValue(customer.organizationStatus)}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(customer.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Activate"
                        disabled={actionMutation.isPending}
                        onClick={() =>
                          actionMutation.mutate({
                            id: customer.id,
                            body: { action: "activate" },
                            successMessage: "Customer activated",
                          })
                        }
                      >
                        <PlayCircle className="size-4 text-emerald-400" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Suspend"
                        disabled={actionMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Suspend customer ${customer.email}?`,
                            )
                          ) {
                            actionMutation.mutate({
                              id: customer.id,
                              body: { action: "suspend" },
                              successMessage: "Customer suspended",
                            });
                          }
                        }}
                      >
                        <PauseCircle className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Assign plan"
                        disabled={actionMutation.isPending}
                        onClick={() => {
                          setAssignCustomer(customer);
                          setAssignPlanKey(
                            (customer.planKey as PlanKey) || "starter",
                          );
                          setAssignInterval(
                            (customer.interval as BillingInterval) || "MONTHLY",
                          );
                        }}
                      >
                        <Package className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Extend subscription"
                        disabled={actionMutation.isPending}
                        onClick={() => {
                          setExtendCustomer(customer);
                          setExtendMonths("1");
                        }}
                      >
                        <CalendarPlus className="size-4" />
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
        open={Boolean(assignCustomer)}
        onOpenChange={(open) => !open && setAssignCustomer(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign plan · {assignCustomer?.email}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={assignPlanKey}
                onValueChange={(v) => setAssignPlanKey(v as PlanKey)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Interval</Label>
              <Select
                value={assignInterval}
                onValueChange={(v) => setAssignInterval(v as BillingInterval)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={actionMutation.isPending || !assignCustomer}
              onClick={() =>
                assignCustomer &&
                actionMutation.mutate({
                  id: assignCustomer.id,
                  body: {
                    action: "assign_plan",
                    planKey: assignPlanKey,
                    interval: assignInterval,
                  },
                  successMessage: "Plan assigned",
                })
              }
            >
              Assign plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(extendCustomer)}
        onOpenChange={(open) => {
          if (!open) {
            setExtendCustomer(null);
            setExtendMonths("1");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend subscription · {extendCustomer?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="extend-months">Extend by (months)</Label>
            <Input
              id="extend-months"
              type="number"
              min={1}
              max={36}
              value={extendMonths}
              onChange={(e) => setExtendMonths(e.target.value)}
            />
            {extendCustomer?.currentPeriodEnd ? (
              <p className="text-xs text-muted-foreground">
                Current period ends {formatDate(extendCustomer.currentPeriodEnd)}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={actionMutation.isPending || !extendCustomer}
              onClick={() => {
                const months = Number(extendMonths);
                if (!Number.isFinite(months) || months < 1 || months > 36) {
                  toast.error("Enter 1–36 months");
                  return;
                }
                extendCustomer &&
                  actionMutation.mutate({
                    id: extendCustomer.id,
                    body: { action: "extend", extendMonths: months },
                    successMessage: `Extended by ${months} month(s)`,
                  });
              }}
            >
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
