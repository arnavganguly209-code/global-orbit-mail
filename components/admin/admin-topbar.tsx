"use client";

import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { architectureAdminSession } from "@/lib/auth";

export function AdminTopbar({
  title,
  description,
  onMenuClick,
}: {
  title: string;
  description?: string;
  onMenuClick?: () => void;
}) {
  const user = architectureAdminSession.user;

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
          <Link href="/admin/logs">
            <Bell className="size-4" />
          </Link>
        </Button>
        <ThemeToggle />
        <div className="hidden rounded-xl border border-border/70 bg-card/50 px-3 py-1.5 text-right sm:block">
          <p className="text-xs font-medium">{user.name}</p>
          <p className="text-[10px] uppercase tracking-wide text-gold">{user.role}</p>
        </div>
      </div>
    </header>
  );
}
