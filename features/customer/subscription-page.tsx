"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { customerFetch } from "@/lib/api/customer-fetch";
import type { ApiResponse } from "@/types";

interface SubscriptionView {
  id: string;
  status: string;
  interval: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: {
    name: string;
    description: string | null;
    monthlyPriceUsd: number | null;
    storageGb: number;
    mailboxLimit: number;
    domainLimit: number;
    features: string[];
  };
}

async function fetchSubscription() {
  const res = await customerFetch("/api/customer/subscription");
  const json = (await res.json()) as ApiResponse<{ subscription: SubscriptionView | null }>;
  if (!json.success) throw new Error("Failed to load subscription");
  return json.data.subscription;
}

export function CustomerSubscriptionPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-subscription"],
    queryFn: fetchSubscription,
  });

  return (
    <>
      <PageHeader
        title="My Subscription"
        description="Plan, limits, and renewal details for your workspace"
        actions={
          <Button asChild variant="outline">
            <Link href="/signup/plan">Change Plan</Link>
          </Button>
        }
      />
      {isLoading ? <Loading label="Loading subscription" /> : null}
      {!isLoading && !data ? (
        <EmptyState
          title="No active subscription"
          description="Choose a plan to unlock domains, mailboxes, and DNS provisioning."
          action={
            <Button asChild className="gradient-blue border-0">
              <Link href="/signup/plan">Choose a Plan</Link>
            </Button>
          }
        />
      ) : null}
      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{data.plan.name}</h2>
              <Badge variant={data.status === "ACTIVE" ? "success" : "warning"}>
                {data.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{data.plan.description}</p>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between border-b border-border/50 py-2">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">
                  {data.plan.monthlyPriceUsd != null ? `$${data.plan.monthlyPriceUsd}/mo` : "Custom"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 py-2">
                <span className="text-muted-foreground">Billing interval</span>
                <span className="font-medium">{data.interval}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 py-2">
                <span className="text-muted-foreground">Current period ends</span>
                <span className="font-medium">
                  {data.currentPeriodEnd
                    ? new Date(data.currentPeriodEnd).toLocaleDateString()
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Domains · Mailboxes · Storage</span>
                <span className="font-medium">
                  {data.plan.domainLimit || "∞"} · {data.plan.mailboxLimit || "∞"} ·{" "}
                  {data.plan.storageGb || "∞"} GB
                </span>
              </div>
            </div>
          </section>
          <section className="glass-surface space-y-3 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">Included features</h2>
            <ul className="space-y-2.5">
              {data.plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-gold" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </>
  );
}
