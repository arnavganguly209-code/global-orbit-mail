"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DollarSign, RefreshCw, TrendingUp, Wallet } from "lucide-react";
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

type RevenuePoint = { date: string; amountUsd: number };

type RevenueData = {
  summary: RevenueSummary;
  revenueSeries: RevenuePoint[];
};

async function fetchRevenue() {
  const res = await adminFetch("/api/admin/revenue");
  const json = (await res.json()) as ApiResponse<RevenueData>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load revenue");
  return json.data;
}

export function RevenueAdminPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: fetchRevenue,
  });

  const chartData = (data?.revenueSeries ?? []).map((p) => ({
    label: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    amount: p.amountUsd,
  }));

  return (
    <AdminShell title="Revenue" description="Paid revenue trends and MRR estimate">
      {isLoading ? <Loading label="Loading revenue…" /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard title="Total paid" value={formatUsd(data.summary.totalPaidUsd)} icon={DollarSign} />
            <StatsCard title="Pending" value={formatUsd(data.summary.pendingUsd)} icon={Wallet} />
            <StatsCard title="Active subs" value={data.summary.activeSubscriptions} icon={RefreshCw} />
            <StatsCard title="Est. MRR" value={formatUsd(data.summary.estimatedMrrUsd)} icon={TrendingUp} />
          </div>

          <GlassPanel className="p-5">
            <h2 className="mb-4 font-display text-xl font-semibold">Paid revenue (90 days)</h2>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid orders in this period.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2f6fed" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#2f6fed" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(139,149,168,0.12)" vertical={false} />
                    <XAxis dataKey="label" stroke="#8b95a8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#8b95a8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v) => formatUsd(typeof v === "number" ? v : Number(v))}
                      contentStyle={{
                        background: "#0b1220",
                        border: "1px solid rgba(212,175,55,0.2)",
                        borderRadius: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#2f6fed"
                      fill="url(#revenueFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassPanel>
        </div>
      ) : null}
    </AdminShell>
  );
}
