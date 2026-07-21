"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Menu, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/api/admin-fetch";

export function AdminTopbar({
  title,
  description,
  onMenuClick,
}: {
  title: string;
  description?: string;
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/auth/me");
      const json = await res.json();
      if (!res.ok || !json.success) return null;
      if (json.data?.csrfToken) {
        const { cacheAdminCsrfToken } = await import("@/lib/api/admin-fetch");
        cacheAdminCsrfToken(json.data.csrfToken);
      }
      return json.data.user as {
        name?: string | null;
        email: string;
        role: string;
        roleName?: string;
        image?: string | null;
        company?: string | null;
      };
    },
  });

  async function logout() {
    await adminFetch("/api/admin/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.replace("/orbit/login");
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
          {description ? (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Notifications">
          <Link href="/orbit/logs">
            <Bell className="size-4" />
          </Link>
        </Button>
        <ThemeToggle />
        <Link
          href="/orbit/profile"
          className="hidden items-center gap-2 rounded-xl border border-border/70 bg-card/50 px-3 py-1.5 text-right transition-colors hover:border-gold/40 sm:flex"
        >
          {data?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.image} alt="" className="size-7 rounded-lg object-cover" />
          ) : (
            <UserCircle className="size-5 text-muted-foreground" />
          )}
          <div>
            <p className="text-xs font-medium">{data?.name ?? data?.email ?? "Admin"}</p>
            <p className="text-[10px] uppercase tracking-wide text-gold">
              {data?.roleName ?? data?.role ?? "SESSION"}
            </p>
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
