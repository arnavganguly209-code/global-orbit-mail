"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
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
import { formatDateTime, formatUsd, pageCount } from "@/features/admin/admin-format";
import type { ApiResponse, PaginatedResult } from "@/types";

type PaymentRow = {
  id: string;
  amountUsd: number;
  currency: string;
  status: string;
  provider: string;
  createdAt: string;
  organization: { id: string; name: string } | null;
};

const PAGE_SIZE = 10;

async function fetchPayments(page: number, status: string) {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status !== "ALL") qs.set("status", status);
  const res = await adminFetch(`/api/admin/payments?${qs}`);
  const json = (await res.json()) as ApiResponse<PaginatedResult<PaymentRow> & { items: PaymentRow[] }>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load payments");
  return json.data;
}

export function PaymentsAdminPage() {
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState("PAID");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments", page, statusFilter],
    queryFn: () => fetchPayments(page, statusFilter),
  });

  const totalPages = pageCount(data?.total ?? 0, PAGE_SIZE);

  return (
    <AdminShell title="Payments" description="Paid and pending payment records">
      <div className="mb-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Loading label="Loading payments…" /> : null}
      {!isLoading && data?.items.length === 0 ? (
        <EmptyState title="No payments" description="Payment records appear when orders are created." />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="space-y-4">
          <div className="glass-surface overflow-hidden rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.organization?.name ?? "—"}</TableCell>
                    <TableCell>{formatUsd(row.amountUsd)}</TableCell>
                    <TableCell>
                      <StatusPill label={row.status} tone={statusToneFromValue(row.status)} uppercase />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.provider}</TableCell>
                    <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />
        </div>
      ) : null}
    </AdminShell>
  );
}
