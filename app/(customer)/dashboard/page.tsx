import { CustomerShell } from "@/components/customer/customer-shell";
import { getSessionFromCookies } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function CustomerDashboardHome() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/signin");

  const subscription = session.organizationId
    ? await prisma.subscription.findFirst({
        where: { organizationId: session.organizationId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const unlocked = subscription?.status === "ACTIVE";
  const [domains, mailboxes] = unlocked
    ? await Promise.all([
        prisma.domain.count({
          where: { organizationId: session.organizationId!, deletedAt: null },
        }),
        prisma.mailbox.count({
          where: { organizationId: session.organizationId!, deletedAt: null },
        }),
      ])
    : [0, 0];

  return (
    <CustomerShell title="Dashboard" description="Your business email workspace">
      {!unlocked ? (
        <div className="glass-surface mb-6 rounded-2xl border border-gold/30 p-6">
          <h2 className="font-display text-xl font-semibold">Complete payment to unlock</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a plan and activate your subscription to manage domains and mailboxes.
          </p>
          <Button asChild className="mt-4 gradient-blue border-0">
            <Link href="/signup/plan">Select plan</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-surface rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Plan</p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {subscription?.plan.name ?? "None"}
          </p>
        </div>
        <div className="glass-surface rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Domains</p>
          <p className="mt-2 font-display text-2xl font-semibold">{domains}</p>
        </div>
        <div className="glass-surface rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Mailboxes</p>
          <p className="mt-2 font-display text-2xl font-semibold">{mailboxes}</p>
        </div>
      </div>

      {unlocked ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/domains">Add domain · DNS wizard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/mailboxes">Create mailbox</Link>
          </Button>
        </div>
      ) : null}
    </CustomerShell>
  );
}
