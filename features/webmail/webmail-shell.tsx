"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Inbox,
  PenSquare,
  Send,
  File,
  ShieldAlert,
  Trash2,
  Users,
  Calendar,
  CheckSquare,
  Settings,
  Search,
  Paperclip,
  LogOut,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customerFetch } from "@/lib/api/customer-fetch";
import { cn } from "@/lib/utils";

const folders = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "compose", label: "Compose", icon: PenSquare },
  { id: "sent", label: "Sent", icon: Send },
  { id: "draft", label: "Draft", icon: File },
  { id: "spam", label: "Spam", icon: ShieldAlert },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

const demoMessages = [
  {
    id: "1",
    from: "Operations",
    subject: "Welcome to GLOBAL ORBIT MAIL",
    preview: "Your premium webmail workspace is ready.",
    time: "9:41 AM",
  },
  {
    id: "2",
    from: "Security",
    subject: "2FA ready on your account",
    preview: "Enable two-factor authentication when you are ready.",
    time: "Yesterday",
  },
];

export function WebmailShell() {
  const router = useRouter();
  const [folder, setFolder] = React.useState<(typeof folders)[number]["id"]>("inbox");

  async function handleLogout() {
    try {
      await customerFetch("/api/webmail/auth/logout", { method: "POST" });
    } catch {
      // best-effort logout
    } finally {
      toast.success("Signed out");
      router.push("/webmail/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-dvh bg-[#070b14] text-foreground">
      <aside className="hidden w-60 flex-col border-r border-white/10 bg-white/[0.03] backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center px-4">
          <BrandLogo href="/webmail" width={140} />
        </div>
        <nav className="space-y-1 px-2 py-3">
          {folders.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolder(f.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  folder === f.id
                    ? "bg-primary/20 text-foreground"
                    : "text-muted-foreground hover:bg-white/5",
                )}
              >
                <Icon className="size-4" />
                {f.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search mail" />
          </div>
          <ThemeToggle />
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleLogout}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <div className="grid flex-1 md:grid-cols-[320px_1fr]">
          <div className="border-r border-white/10">
            {demoMessages.map((m, i) => (
              <motion.button
                key={m.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="w-full border-b border-white/5 px-4 py-3 text-left hover:bg-white/[0.04]"
              >
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium">{m.from}</p>
                  <span className="text-[10px] text-muted-foreground">{m.time}</span>
                </div>
                <p className="mt-1 text-sm">{m.subject}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.preview}</p>
              </motion.button>
            ))}
          </div>
          <div className="flex flex-col p-6">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-2xl font-semibold capitalize">{folder}</h1>
              <Button variant="outline" size="sm">
                <Paperclip className="size-3.5" />
                Attachments
              </Button>
            </div>
            <div className="mt-6 flex-1 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
              <p className="text-sm text-muted-foreground">
                Premium webmail UI shell — IMAP/SMTP connection deferred. Signature, search, and
                2FA-ready settings are part of this interface architecture.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
