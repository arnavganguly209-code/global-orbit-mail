"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
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
import { formatDate, formatUsd, pageCount } from "@/features/admin/admin-format";
import type { ApiResponse, PaginatedResult } from "@/types";

type InvoiceRow = {
  id: string;
  number: string;
  amountUsd: number;
  status: string;
  issuedAt: string;
  paidAt: string | null;
  organization: { id: string; name: string } | null;
};

const PAGE_SIZE = 10;

async function fetchInvoices(page: number) {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  const res = await adminFetch(`/api/admin/invoices?${qs}`);
  const json = (await res.json()) as ApiResponse<PaginatedResult<InvoiceRow> & { items: InvoiceRow[] }>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load invoices");
  return json.data;
}

export function InvoicesAdminPage() {
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-invoices", page],
    queryFn: () => fetchInvoices(page),
  });

  const totalPages = pageCount(data?.total ?? 0, PAGE_SIZE);

  return (
    <AdminShell title="Invoices" description="Issued invoices and payment status">
      {isLoading ? <Loading label="Loading invoices…" /> : null}
      {!isLoading && data?.items.length === 0 ? (
        <EmptyState title="No invoices" description="Invoices are generated when subscriptions are activated." />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="space-y-4">
          <div className="glass-surface overflow-hidden rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>{inv.organization?.name ?? "—"}</TableCell>
                    <TableCell>{formatUsd(inv.amountUsd)}</TableCell>
                    <TableCell>
                      <StatusPill label={inv.status} tone={statusToneFromValue(inv.status)} uppercase />
                    </TableCell>
                    <TableCell>{formatDate(inv.issuedAt)}</TableCell>
                    <TableCell>{formatDate(inv.paidAt)}</TableCell>
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
