"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
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

interface BillingView {
  subscription: {
    status: string;
    plan: { name: string; monthlyPriceUsd: number | null };
  } | null;
  orders: {
    id: string;
    amountUsd: number;
    currency: string;
    status: string;
    provider: string;
    createdAt: string;
  }[];
  invoices: { id: string; number: string; amountUsd: number; status: string }[];
}

async function fetchBilling() {
  const res = await customerFetch("/api/customer/billing");
  const json = (await res.json()) as ApiResponse<BillingView>;
  if (!json.success) throw new Error("Failed to load billing");
  return json.data;
}

export function CustomerBillingPage() {
  const { data, isLoading } = useQuery({ queryKey: ["customer-billing"], queryFn: fetchBilling });

  return (
    <>
      <PageHeader
        title="Billing"
        description="Payment method, plan, and order history"
        actions={
          !data?.subscription ? (
            <Button asChild className="gradient-blue border-0">
              <Link href="/signup/plan">Complete Payment</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/signup/plan">Change Plan</Link>
            </Button>
          )
        }
      />
      {isLoading ? <Loading label="Loading billing" /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="glass-surface flex flex-col items-start justify-between gap-3 rounded-2xl p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
                <Receipt className="size-4" />
              </div>
              <div>
                <p className="font-medium">
                  {data.subscription ? data.subscription.plan.name : "No active plan"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.subscription?.plan.monthlyPriceUsd != null
                    ? `$${data.subscription.plan.monthlyPriceUsd}/month`
                    : "Select a plan to activate billing"}
                </p>
              </div>
            </div>
            {data.subscription ? (
              <StatusPill
                label={data.subscription.status}
                tone={statusToneFromValue(data.subscription.status)}
              />
            ) : null}
          </div>

          {data.orders.length === 0 ? (
            <EmptyState title="No orders yet" description="Payments will appear here once you activate a plan." />
          ) : (
            <div className="glass-surface overflow-hidden rounded-2xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        ${order.amountUsd.toFixed(2)} {order.currency}
                      </TableCell>
                      <TableCell className="capitalize">{order.provider}</TableCell>
                      <TableCell>
                        <StatusPill label={order.status} tone={statusToneFromValue(order.status)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
