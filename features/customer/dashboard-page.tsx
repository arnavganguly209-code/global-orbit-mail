"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Globe2, Inbox, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatsCard } from "@/components/admin/stats-card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { customerFetch } from "@/lib/api/customer-fetch";
import type { ApiResponse, PaginatedResult, AdminDomain, AdminMailbox } from "@/types";

interface SubscriptionSummary {
  status: string;
  plan: { name: string; monthlyPriceUsd: number | null };
  currentPeriodEnd: string | null;
}

async function fetchOverview() {
  const [domainsRes, mailboxesRes, subRes] = await Promise.all([
    customerFetch("/api/customer/domains?page=1&pageSize=100"),
    customerFetch("/api/customer/mailboxes?page=1&pageSize=100"),
    customerFetch("/api/customer/subscription"),
  ]);
  const domainsJson = (await domainsRes.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
  const mailboxesJson = (await mailboxesRes.json()) as ApiResponse<PaginatedResult<AdminMailbox>>;
  const subJson = (await subRes.json()) as ApiResponse<{ subscription: SubscriptionSummary | null }>;

  return {
    domains: domainsJson.success ? domainsJson.data : { items: [], total: 0 },
    mailboxes: mailboxesJson.success ? mailboxesJson.data : { items: [], total: 0 },
    subscription: subJson.success ? subJson.data.subscription : null,
  };
}

export function CustomerDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-overview"],
    queryFn: fetchOverview,
  });

  return (
    <>
      <PageHeader
        title="Welcome back"
        description="Your GLOBAL ORBIT MAIL workspace at a glance"
      />
      {isLoading ? <Loading label="Loading workspace" fullScreen /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Domains"
              value={data.domains.total}
              hint="Connected custom domains"
              icon={Globe2}
            />
            <StatsCard
              title="Mailboxes"
              value={data.mailboxes.total}
              hint="Provisioned identities"
              icon={Inbox}
            />
            <StatsCard
              title="Plan"
              value={data.subscription?.plan.name ?? "No plan"}
              hint={
                data.subscription?.plan.monthlyPriceUsd != null
                  ? `$${data.subscription.plan.monthlyPriceUsd}/mo`
                  : "Choose a plan"
              }
              icon={CreditCard}
            />
            <StatsCard
              title="Subscription"
              value={data.subscription?.status ?? "INACTIVE"}
              hint={
                data.subscription?.currentPeriodEnd
                  ? `Renews ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}`
                  : "Payment required"
              }
              icon={ShieldCheck}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass-surface space-y-4 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Domains</h2>
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/domains">Manage</Link>
                </Button>
              </div>
              <ul className="space-y-2">
                {data.domains.items.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    No domains yet — add your first domain to begin.
                  </li>
                ) : (
                  data.domains.items.slice(0, 5).map((domain) => (
                    <li
                      key={domain.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-4 py-2.5"
                    >
                      <span className="text-sm font-medium">{domain.name}</span>
                      <StatusPill
                        label={domain.status}
                        tone={statusToneFromValue(domain.status)}
                      />
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="glass-surface space-y-4 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Mailboxes</h2>
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/mailboxes">Manage</Link>
                </Button>
              </div>
              <ul className="space-y-2">
                {data.mailboxes.items.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    No mailboxes yet — create one on a verified domain.
                  </li>
                ) : (
                  data.mailboxes.items.slice(0, 5).map((mailbox) => (
                    <li
                      key={mailbox.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-4 py-2.5"
                    >
                      <span className="text-sm font-medium">{mailbox.email}</span>
                      <StatusPill
                        label={mailbox.status}
                        tone={statusToneFromValue(mailbox.status)}
                      />
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
