"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NavItem } from "@/types";

export interface SidebarProps {
  items: NavItem[];
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sidebar({ items, className, header, footer }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      {header ? <div className="border-b border-sidebar-border p-4">{header}</div> : null}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                aria-disabled={item.disabled}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                  item.disabled && "pointer-events-none opacity-50",
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      {footer ? <div className="border-t border-sidebar-border p-4">{footer}</div> : null}
    </aside>
  );
}
