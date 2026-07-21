"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { customerNav } from "@/config/customer-nav";
import { adminFetch } from "@/lib/api/admin-fetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function CustomerShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await adminFetch("/api/admin/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.replace("/signin");
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-card/40 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-border/70 px-4">
          <BrandLogo href="/dashboard" width={150} />
        </div>
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
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
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-4", active && "text-gold")} />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border/70 px-4 sm:px-6">
          <div>
            <h1 className="font-display text-lg font-semibold">{title}</h1>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/webmail">Open Webmail</Link>
            </Button>
            <ThemeToggle />
            <Button type="button" variant="ghost" size="sm" onClick={logout}>
              <LogOut className="size-3.5" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
