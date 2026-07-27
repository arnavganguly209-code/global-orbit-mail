"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  DollarSign,
  FileText,
  Package,
  RefreshCw,
  ShoppingCart,
  Ticket,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatsCard } from "@/components/admin/stats-card";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Loading } from "@/components/ui/loading";
import { adminFetch } from "@/lib/api/admin-fetch";
import { formatUsd } from "@/features/admin/admin-format";
import type { ApiResponse } from "@/types";

type RevenueSummary = {
  totalPaidUsd: number;
  pendingUsd: number;
  activeSubscriptions: number;
  estimatedMrrUsd: number;
};

async function fetchRevenueSummary() {
  const res = await adminFetch("/api/admin/revenue");
  const json = (await res.json()) as ApiResponse<{ summary: RevenueSummary }>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load billing summary");
  return json.data.summary;
}

const billingLinks = [
  { href: "/orbit/plans", title: "Plans", description: "Create and manage subscription plans", icon: Package },
  { href: "/orbit/subscriptions", title: "Subscriptions", description: "View and activate customer subscriptions", icon: RefreshCw },
  { href: "/orbit/orders", title: "Orders", description: "Billing orders and payment status", icon: ShoppingCart },
  { href: "/orbit/invoices", title: "Invoices", description: "Issued invoices and payment history", icon: FileText },
  { href: "/orbit/coupons", title: "Coupons", description: "Discount codes and redemptions", icon: Ticket },
  { href: "/orbit/revenue", title: "Revenue", description: "Revenue trends and MRR breakdown", icon: TrendingUp },
  { href: "/orbit/payments", title: "Payments", description: "Paid and pending payment records", icon: Wallet },
] as const;

export function BillingHubPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-revenue-summary"],
    queryFn: fetchRevenueSummary,
  });

  return (
    <AdminShell
      title="Billing"
      description="Plans, subscriptions, revenue, and payment operations"
    >
      {isLoading ? <Loading label="Loading billing summary…" /> : null}
      {data ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Total paid" value={formatUsd(data.totalPaidUsd)} icon={DollarSign} />
          <StatsCard title="Pending" value={formatUsd(data.pendingUsd)} icon={CreditCard} />
          <StatsCard title="Active subs" value={data.activeSubscriptions} icon={RefreshCw} />
          <StatsCard title="Est. MRR" value={formatUsd(data.estimatedMrrUsd)} icon={TrendingUp} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {billingLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <GlassPanel className="group h-full p-5 transition-colors hover:border-primary/30">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-primary/15 p-2.5 text-primary transition-colors group-hover:bg-primary/25">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold">{item.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </GlassPanel>
            </Link>
          );
        })}
      </div>
    </AdminShell>
  );
}
