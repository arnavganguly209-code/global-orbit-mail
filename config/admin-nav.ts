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
  BarChart3,
  CreditCard,
  Package,
  RefreshCw,
  ShoppingCart,
  FileText,
  Ticket,
  TrendingUp,
  Wallet,
  Mail,
  DatabaseBackup,
  ArrowRightLeft,
  ShieldAlert,
  HeartPulse,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

/** Phase 1 + Phase 2 production Orbit modules. */
export const adminNav: AdminNavItem[] = [
  { title: "Dashboard", href: "/orbit", icon: LayoutDashboard },
  { title: "Customers", href: "/orbit/customers", icon: Building2 },
  { title: "Domains", href: "/orbit/domains", icon: Globe2 },
  { title: "Mailboxes", href: "/orbit/mailboxes", icon: Inbox },
  { title: "Mail Health", href: "/orbit/mail-health", icon: HeartPulse },
  { title: "Users", href: "/orbit/users", icon: Users },
  { title: "DNS Manager", href: "/orbit/dns", icon: Network },
  { title: "Logs", href: "/orbit/logs", icon: ScrollText },
  { title: "Monitoring", href: "/orbit/monitoring", icon: Activity },
  { title: "Analytics", href: "/orbit/analytics", icon: BarChart3 },
  { title: "Billing", href: "/orbit/billing", icon: CreditCard },
  { title: "Plans", href: "/orbit/plans", icon: Package },
  { title: "Subscriptions", href: "/orbit/subscriptions", icon: RefreshCw },
  { title: "Orders", href: "/orbit/orders", icon: ShoppingCart },
  { title: "Invoices", href: "/orbit/invoices", icon: FileText },
  { title: "Coupons", href: "/orbit/coupons", icon: Ticket },
  { title: "Revenue", href: "/orbit/revenue", icon: TrendingUp },
  { title: "Payments", href: "/orbit/payments", icon: Wallet },
  { title: "Templates", href: "/orbit/templates", icon: Mail },
  { title: "Backups", href: "/orbit/backups", icon: DatabaseBackup },
  { title: "Migration", href: "/orbit/migration", icon: ArrowRightLeft },
  { title: "Spam Tools", href: "/orbit/spam", icon: ShieldAlert },
  { title: "Profile", href: "/orbit/profile", icon: UserCircle },
  { title: "Settings", href: "/orbit/settings", icon: Settings },
];
