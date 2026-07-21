import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CustomerShell } from "@/components/customer/customer-shell";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s · GLOBAL ORBIT MAIL",
  },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "CUSTOMER") {
    redirect(`${routes.signin}?next=${routes.dashboard}`);
  }

  const subscription = session.organizationId
    ? await prisma.subscription.findFirst({
        where: { organizationId: session.organizationId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return (
    <CustomerShell
      user={{ name: session.name, email: session.email }}
      hasActiveSubscription={Boolean(subscription)}
    >
      {children}
    </CustomerShell>
  );
}
