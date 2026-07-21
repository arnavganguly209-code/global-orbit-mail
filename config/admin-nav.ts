import {
  LayoutDashboard,
  Globe2,
  Inbox,
  Users,
  Network,
  FileText,
  ScrollText,
  Shield,
  Activity,
  CreditCard,
  Code2,
  Server,
  Settings,
  LifeBuoy,
  BookOpen,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const adminNav: AdminNavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Domains", href: "/admin/domains", icon: Globe2 },
  { title: "Mailboxes", href: "/admin/mailboxes", icon: Inbox },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "DNS Manager", href: "/admin/dns", icon: Network },
  { title: "Templates", href: "/admin/templates", icon: FileText },
  { title: "Logs", href: "/admin/logs", icon: ScrollText },
  { title: "Security", href: "/admin/security", icon: Shield },
  { title: "Monitoring", href: "/admin/monitoring", icon: Activity },
  { title: "Billing", href: "/admin/billing", icon: CreditCard },
  { title: "API", href: "/admin/api", icon: Code2 },
  { title: "System", href: "/admin/system", icon: Server },
  { title: "Profile", href: "/admin/profile", icon: UserCircle },
  { title: "Settings", href: "/admin/settings", icon: Settings },
  { title: "Support", href: "/admin/support", icon: LifeBuoy },
  { title: "Documentation", href: "/admin/documentation", icon: BookOpen },
];
