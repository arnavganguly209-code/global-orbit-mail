import {
  LayoutDashboard,
  Globe2,
  Inbox,
  Users,
  Network,
  ScrollText,
  Activity,
  Settings,
  UserCircle,
  Building2,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

/** Phase 1: only production-ready Orbit modules (no placeholder pages). */
export const adminNav: AdminNavItem[] = [
  { title: "Dashboard", href: "/orbit", icon: LayoutDashboard },
  { title: "Customers", href: "/orbit/customers", icon: Building2 },
  { title: "Domains", href: "/orbit/domains", icon: Globe2 },
  { title: "Mailboxes", href: "/orbit/mailboxes", icon: Inbox },
  { title: "Users", href: "/orbit/users", icon: Users },
  { title: "DNS Manager", href: "/orbit/dns", icon: Network },
  { title: "Logs", href: "/orbit/logs", icon: ScrollText },
  { title: "Monitoring", href: "/orbit/monitoring", icon: Activity },
  { title: "Profile", href: "/orbit/profile", icon: UserCircle },
  { title: "Settings", href: "/orbit/settings", icon: Settings },
];
