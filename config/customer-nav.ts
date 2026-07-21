import {
  LayoutDashboard,
  CreditCard,
  FileText,
  Globe2,
  Inbox,
  AtSign,
  Forward,
  Network,
  Shield,
  UserCircle,
  LifeBuoy,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface CustomerNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const customerNav: CustomerNavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "My Subscription", href: "/dashboard/subscription", icon: CreditCard },
  { title: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { title: "Invoices", href: "/dashboard/invoices", icon: FileText },
  { title: "Domains", href: "/dashboard/domains", icon: Globe2 },
  { title: "Mailboxes", href: "/dashboard/mailboxes", icon: Inbox },
  { title: "Aliases", href: "/dashboard/aliases", icon: AtSign },
  { title: "Forwarders", href: "/dashboard/forwarders", icon: Forward },
  { title: "DNS Setup", href: "/dashboard/dns", icon: Network },
  { title: "Security", href: "/dashboard/security", icon: Shield },
  { title: "Profile", href: "/dashboard/profile", icon: UserCircle },
  { title: "Support", href: "/dashboard/support", icon: LifeBuoy },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];
