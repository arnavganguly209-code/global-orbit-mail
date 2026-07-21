"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { CustomerSidebar, CustomerMobileNav } from "@/components/customer/customer-sidebar";
import { CustomerTopbar } from "@/components/customer/customer-topbar";
import { Button } from "@/components/ui/button";

export function CustomerShell({
  children,
  user,
  hasActiveSubscription,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email: string };
  hasActiveSubscription: boolean;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 mesh-gradient opacity-80" />
      <CustomerSidebar />
      <CustomerMobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CustomerTopbar
          onMenuClick={() => setMobileOpen(true)}
          userName={user.name}
          userEmail={user.email}
        />
        {!hasActiveSubscription ? (
          <div className="flex flex-col items-center justify-between gap-3 border-b border-gold/20 bg-gold/10 px-4 py-3 text-sm sm:flex-row sm:px-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-gold" />
              <span>
                Your workspace doesn&apos;t have an active subscription yet. Complete payment to
                unlock domains, mailboxes, and DNS provisioning.
              </span>
            </div>
            <Button asChild size="sm" className="shrink-0 gradient-blue border-0">
              <Link href="/dashboard/billing">Complete Payment</Link>
            </Button>
          </div>
        ) : null}
        <div className="flex-1 px-4 pb-8 pt-6 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
