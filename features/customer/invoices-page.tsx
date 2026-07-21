"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { customerFetch } from "@/lib/api/customer-fetch";
import type { ApiResponse } from "@/types";

interface InvoiceView {
  id: string;
  number: string;
  amountUsd: number;
  status: string;
  issuedAt: string;
  paidAt: string | null;
}

async function fetchInvoices() {
  const res = await customerFetch("/api/customer/billing");
  const json = (await res.json()) as ApiResponse<{ invoices: InvoiceView[] }>;
  if (!json.success) throw new Error("Failed to load invoices");
  return json.data.invoices;
}

export function CustomerInvoicesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["customer-invoices"], queryFn: fetchInvoices });

  return (
    <>
      <PageHeader title="Invoices" description="Download and review your billing history" />
      {isLoading ? <Loading label="Loading invoices" /> : null}
      {data && data.length === 0 ? (
        <EmptyState title="No invoices yet" description="Invoices appear after your first payment." />
      ) : null}
      {data && data.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-xs">{invoice.number}</TableCell>
                  <TableCell>{new Date(invoice.issuedAt).toLocaleDateString()}</TableCell>
                  <TableCell>${invoice.amountUsd.toFixed(2)}</TableCell>
                  <TableCell>
                    <StatusPill label={invoice.status} tone={statusToneFromValue(invoice.status)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="icon" variant="ghost" disabled title="PDF export coming soon">
                      <Download className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}
