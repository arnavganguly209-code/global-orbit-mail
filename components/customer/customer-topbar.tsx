"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { customerFetch } from "@/lib/api/customer-fetch";
import { customerNav } from "@/config/customer-nav";

export function CustomerTopbar({
  onMenuClick,
  userName,
  userEmail,
}: {
  onMenuClick?: () => void;
  userName?: string | null;
  userEmail?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const title =
    [...customerNav]
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.title ?? "Dashboard";

  async function logout() {
    await customerFetch("/api/customer/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.replace("/signin");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-semibold tracking-tight">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Notifications">
          <Link href="/dashboard/support">
            <Bell className="size-4" />
          </Link>
        </Button>
        <ThemeToggle />
        <Link
          href="/dashboard/profile"
          className="hidden items-center gap-2 rounded-xl border border-border/70 bg-card/50 px-3 py-1.5 text-right transition-colors hover:border-gold/40 sm:flex"
        >
          <UserCircle className="size-5 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium">{userName ?? userEmail ?? "Customer"}</p>
            <p className="text-[10px] uppercase tracking-wide text-gold">CUSTOMER</p>
          </div>
        </Link>
        <Button type="button" variant="outline" size="sm" onClick={logout}>
          <LogOut className="size-3.5" />
          Logout
        </Button>
      </div>
    </header>
  );
}
