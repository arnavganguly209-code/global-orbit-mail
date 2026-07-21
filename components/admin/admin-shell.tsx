"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { BrandLogo } from "@/components/shared/brand-logo";
import { adminNav } from "@/config/admin-nav";
import { cn } from "@/lib/utils";

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        <BrandLogo href="/admin" width={160} className="mb-6 w-[150px]" />
        <nav className="space-y-1 overflow-y-auto">
          {adminNav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
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

export function AdminShell({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 mesh-gradient opacity-80" />
      <AdminSidebar />
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          title={title}
          description={description}
          onMenuClick={() => setMobileOpen(true)}
        />
        {actions ? (
          <div className="flex items-center justify-end gap-2 px-4 pt-4 sm:px-6">
            {actions}
          </div>
        ) : null}
        <div className="flex-1 px-4 pb-8 pt-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
