"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { adminNav } from "@/config/admin-nav";
import { adminFetch } from "@/lib/api/admin-fetch";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();
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
      return json.data.user as { roleName?: string; role?: string };
    },
  });

  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/90 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <BrandLogo href="/orbit" width={160} className="w-[150px]" />
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {adminNav.map((item) => {
            const active =
              item.href === "/orbit"
                ? pathname === "/orbit"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_rgba(47,111,237,0.25)]"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-gold")} />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
        {data?.roleName ?? data?.role ?? "Admin"} · Live
      </div>
    </aside>
  );
}
