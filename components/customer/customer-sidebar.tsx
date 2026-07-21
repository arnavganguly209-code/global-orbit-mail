"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { customerNav } from "@/config/customer-nav";
import { cn } from "@/lib/utils";

export function CustomerSidebar({ roleLabel }: { roleLabel?: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/90 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <BrandLogo href="/dashboard" width={160} className="w-[150px]" />
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {customerNav.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
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
        {roleLabel ?? "Customer"} · Live
      </div>
    </aside>
  );
}

export function CustomerMobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close navigation overlay"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-[#070b14] p-4 shadow-2xl">
        <BrandLogo href="/dashboard" width={160} className="mb-6 w-[150px]" />
        <nav className="space-y-1 overflow-y-auto">
          {customerNav.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                  active ? "bg-primary/15 text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
