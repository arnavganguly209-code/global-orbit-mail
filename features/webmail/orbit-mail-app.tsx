"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Archive,
  Bell,
  ChevronDown,
  Forward,
  Inbox,
  LogOut,
  Mail,
  Moon,
  Paperclip,
  PenSquare,
  Printer,
  Reply,
  ReplyAll,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Star,
  Sun,
  Trash2,
  X,
  FileText,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Folder = {
  path: string;
  name: string;
  unseen: number;
  messages: number;
  specialUse?: string | null;
};

type MessageItem = {
  uid: number;
  subject: string;
  from: string;
  fromEmail: string;
  date: string | null;
  preview: string;
  unseen: boolean;
  flagged: boolean;
  hasAttachment: boolean;
};

type MessageDetail = {
  uid: number;
  folder: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  cc: string;
  date: string | null;
  text: string;
  html: string;
  messageId?: string;
  attachments: Array<{ part: string; filename: string; contentType: string; size: number }>;
};

type Me = { email: string; name: string; online: boolean };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }
  return json.data as T;
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function folderIconLabel(f: Folder) {
  const u = (f.specialUse || f.path || "").toUpperCase();
  if (u.includes("INBOX") || f.path.toUpperCase() === "INBOX") return "Inbox";
  if (u.includes("SENT")) return "Sent";
  if (u.includes("DRAFT")) return "Drafts";
  if (u.includes("JUNK") || u.includes("SPAM")) return "Spam";
  if (u.includes("TRASH") || u.includes("DELETED")) return "Trash";
  if (u.includes("ARCHIVE")) return "Archive";
  if (u.includes("FLAG")) return "Starred";
  return f.name;
}

export function OrbitMailApp() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [me, setMe] = React.useState<Me | null>(null);
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [folder, setFolder] = React.useState("INBOX");
  const [messages, setMessages] = React.useState<MessageItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [selectedUid, setSelectedUid] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<MessageDetail | null>(null);
  const [query, setQuery] = React.useState("");
  const [loadingList, setLoadingList] = React.useState(true);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [compose, setCompose] = React.useState({
    to: "",
    subject: "",
    body: "",
    mode: "new" as "new" | "reply" | "replyAll" | "forward",
  });

  const refreshFolders = React.useCallback(async () => {
    const data = await api<{ folders: Folder[] }>("/api/webmail/folders");
    setFolders(data.folders);
  }, []);

  const refreshMessages = React.useCallback(async (path: string) => {
    setLoadingList(true);
    try {
      const data = await api<{ messages: MessageItem[]; total: number }>(
        `/api/webmail/messages?folder=${encodeURIComponent(path)}&page=1`,
      );
      setMessages(data.messages);
      setTotal(data.total);
    } finally {
      setLoadingList(false);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const profile = await api<Me>("/api/webmail/auth/me");
        setMe(profile);
        await refreshFolders();
        await refreshMessages("INBOX");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Session expired");
        router.replace("/webmail/login");
      }
    })();
  }, [refreshFolders, refreshMessages, router]);

  async function openMessage(uid: number) {
    setSelectedUid(uid);
    try {
      const data = await api<MessageDetail>(
        `/api/webmail/messages/${uid}?folder=${encodeURIComponent(folder)}`,
      );
      setDetail(data);
      setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, unseen: false } : m)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open message");
    }
  }

  async function runAction(action: string, extra?: Record<string, unknown>) {
    if (!selectedUid) return;
    try {
      await api("/api/webmail/messages/action", {
        method: "POST",
        body: JSON.stringify({ action, folder, uids: [selectedUid], ...extra }),
      });
      toast.success("Done");
      setDetail(null);
      setSelectedUid(null);
      await refreshMessages(folder);
      await refreshFolders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      await refreshMessages(folder);
      return;
    }
    try {
      const data = await api<{ messages: MessageItem[] }>(
        `/api/webmail/search?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(query)}`,
      );
      setMessages(data.messages);
      setTotal(data.messages.length);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    }
  }

  async function logout() {
    await fetch("/api/webmail/auth/logout", { method: "POST" });
    router.replace("/webmail/login");
    router.refresh();
  }

  function startReply(mode: "reply" | "replyAll" | "forward") {
    if (!detail) return;
    const to =
      mode === "forward"
        ? ""
        : mode === "replyAll"
          ? [detail.fromEmail, detail.to].filter(Boolean).join(", ")
          : detail.fromEmail;
    const subjectPrefix = mode === "forward" ? "Fwd: " : "Re: ";
    const subject = detail.subject.startsWith("Re:") || detail.subject.startsWith("Fwd:")
      ? detail.subject
      : `${subjectPrefix}${detail.subject}`;
    const quoted = `\n\n----------\nOn ${detail.date || ""}, ${detail.from} wrote:\n${detail.text || ""}`;
    setCompose({
      to,
      subject,
      body: mode === "forward" ? detail.text || "" : quoted,
      mode,
    });
    setComposeOpen(true);
  }

  async function sendCompose() {
    try {
      await api("/api/webmail/messages/send", {
        method: "POST",
        body: JSON.stringify({
          to: compose.to,
          subject: compose.subject,
          text: compose.body,
          inReplyTo: compose.mode.startsWith("reply") ? detail?.messageId : undefined,
        }),
      });
      toast.success("Message sent");
      setComposeOpen(false);
      setCompose({ to: "", subject: "", body: "", mode: "new" });
      await refreshFolders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    }
  }

  const inboxUnseen = folders.find((f) => f.path.toUpperCase() === "INBOX")?.unseen ?? 0;
  const light = resolvedTheme === "light";

  return (
    <div
      className={cn(
        "flex h-dvh overflow-hidden font-sans",
        light ? "bg-[#f3f4f7] text-slate-900" : "bg-[#050508] text-[#f5f5f7]",
      )}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          "flex w-[260px] shrink-0 flex-col border-r",
          light ? "border-slate-200 bg-white" : "border-white/8 bg-[#0b0b11]",
        )}
      >
        <div className="px-4 pb-2 pt-4">
          <Image
            src="/brand/logo.png"
            alt="GLOBAL ORBIT PVT LTD"
            width={200}
            height={56}
            className="mx-auto h-auto w-[180px]"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setCompose({ to: "", subject: "", body: "", mode: "new" });
            setComposeOpen(true);
          }}
          className="mx-3 mb-3 mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] px-4 py-3 text-sm font-bold text-[#1a1200] shadow-[0_8px_22px_rgba(212,175,55,0.28)] transition hover:brightness-105"
        >
          <PenSquare className="size-4" />
          Compose
        </button>

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          <p className="mb-1 px-3 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#d4af37]/85">
            Mailbox
          </p>
          {folders.map((f) => {
            const active = f.path === folder;
            const label = folderIconLabel(f);
            const Icon =
              label === "Inbox"
                ? Inbox
                : label === "Sent"
                  ? Send
                  : label === "Spam"
                    ? ShieldAlert
                    : label === "Trash"
                      ? Trash2
                      : label === "Archive"
                        ? Archive
                        : label === "Starred"
                          ? Star
                          : Mail;
            return (
              <button
                key={f.path}
                type="button"
                onClick={() => {
                  setFolder(f.path);
                  setDetail(null);
                  setSelectedUid(null);
                  void refreshMessages(f.path);
                }}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm transition",
                  active
                    ? "bg-[rgba(212,175,55,0.18)] font-semibold text-[#f0d78c] shadow-[inset_3px_0_0_#d4af37]"
                    : light
                      ? "text-slate-600 hover:bg-amber-50"
                      : "text-zinc-400 hover:bg-[rgba(212,175,55,0.12)] hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {f.unseen > 0 ? (
                  <span className="min-w-[1.35rem] rounded-full bg-[#d4af37] px-1.5 text-center text-[0.7rem] font-bold text-[#1a1200]">
                    {f.unseen}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className={cn("mx-3 mb-3 rounded-xl border p-3", light ? "border-slate-200 bg-slate-50" : "border-white/8 bg-[#12121a]")}>
          <p className="text-xs text-zinc-400">Storage</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[24%] rounded-full bg-gradient-to-r from-[#f6e7a8] to-[#c9971a]" />
          </div>
          <p className="mt-1.5 text-[0.7rem] text-zinc-500">Mailbox connected</p>
        </div>

        <div className="flex items-center justify-around border-t border-white/8 px-2 py-3">
          <button type="button" className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white" title="Settings">
            <Settings className="size-4" />
          </button>
          <button type="button" className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white" title="Help">
            <HelpCircle className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setTheme(light ? "dark" : "light")}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-[#f0d78c]"
            title="Theme"
          >
            {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>
          <button type="button" onClick={() => void logout()} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white" title="Logout">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* List column */}
      <section
        className={cn(
          "flex w-[380px] shrink-0 flex-col border-r",
          light ? "border-slate-200 bg-white" : "border-white/8 bg-[#0a0a10]",
        )}
      >
        <div className="flex items-center gap-2 border-b border-white/8 px-3 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
            <i className="size-1.5 rounded-full bg-emerald-400" />
            Online
            <ChevronDown className="size-3 opacity-60" />
          </span>
          <form onSubmit={onSearch} className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mail..."
              className={cn(
                "h-9 w-full rounded-xl border pl-9 pr-12 text-sm outline-none focus:border-[#d4af37]/70",
                light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#0a0a12] text-white",
              )}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1.5 text-[0.65rem] text-zinc-500">
              ⌘ K
            </span>
          </form>
          <button type="button" className="relative rounded-lg p-2 text-zinc-400 hover:bg-white/5">
            <Bell className="size-4" />
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-[#d4af37]" />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">
            Inbox <span className="text-[#f0d78c]">{inboxUnseen || total}</span>
          </h2>
          <div className="flex gap-1 text-zinc-400">
            <button type="button" onClick={() => void refreshMessages(folder)} className="rounded-lg p-1.5 hover:bg-white/5" title="Refresh">
              ↻
            </button>
          </div>
        </div>

        <div className="flex gap-4 border-b border-white/8 px-4 text-sm">
          <span className="border-b-2 border-[#d4af37] pb-2 font-semibold text-[#f0d78c]">Primary</span>
          <span className="pb-2 text-zinc-500">Social</span>
          <span className="pb-2 text-zinc-500">Promotions</span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loadingList ? (
            <p className="p-4 text-sm text-zinc-500">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No messages</p>
          ) : (
            messages.map((m) => {
              const active = m.uid === selectedUid;
              return (
                <button
                  key={m.uid}
                  type="button"
                  onClick={() => void openMessage(m.uid)}
                  className={cn(
                    "mb-1.5 flex w-full gap-3 rounded-xl border px-3 py-3 text-left transition",
                    active
                      ? "border-[#d4af37]/55 bg-[rgba(212,175,55,0.12)] shadow-[0_0_24px_rgba(212,175,55,0.08)]"
                      : light
                        ? "border-transparent hover:bg-slate-50"
                        : "border-transparent hover:bg-white/[0.03]",
                    m.unseen && "font-semibold",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37]/40 to-[#1e5fa1]/40 text-xs font-bold">
                    {initials(m.from || m.fromEmail)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{m.from || m.fromEmail}</span>
                      <span className="shrink-0 text-[0.7rem] text-zinc-500">{formatWhen(m.date)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm">{m.subject}</span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs font-normal text-zinc-500">
                      {m.hasAttachment ? <Paperclip className="size-3" /> : null}
                      {m.preview || " "}
                    </span>
                  </span>
                  <Star
                    className={cn("mt-1 size-3.5 shrink-0", m.flagged ? "fill-[#d4af37] text-[#d4af37]" : "text-zinc-600")}
                  />
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-white/8 px-4 py-2 text-xs text-zinc-500">
          1–{Math.min(50, total)} of {total}
        </div>
      </section>

      {/* Reading pane */}
      <section className={cn("flex min-w-0 flex-1 flex-col", light ? "bg-white" : "bg-[#0a0a10]")}>
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
          <div className="flex flex-wrap items-center gap-1 text-sm text-zinc-400">
            {[
              { label: "Archive", icon: Archive, fn: () => runAction("archive") },
              { label: "Delete", icon: Trash2, fn: () => runAction("delete") },
              { label: "Spam", icon: ShieldAlert, fn: () => runAction("spam") },
            ].map((a) => (
              <button
                key={a.label}
                type="button"
                disabled={!selectedUid}
                onClick={() => void a.fn()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5 disabled:opacity-40"
              >
                <a.icon className="size-3.5" />
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{me?.name}</p>
              <p className="text-xs text-zinc-500">{me?.email}</p>
            </div>
          </div>
        </div>

        {!detail ? (
          <div className="flex flex-1 flex-col items-center justify-center text-zinc-500">
            <Mail className="mb-3 size-10 opacity-40" />
            <p className="text-sm">Select a message to read</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-white/8 px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl font-bold leading-snug">{detail.subject}</h1>
                <span className="rounded-full bg-[#d4af37]/20 px-2 py-0.5 text-xs font-semibold text-[#f0d78c]">
                  Inbox
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37]/50 to-[#1e5fa1]/50 text-sm font-bold">
                    {initials(detail.from)}
                  </span>
                  <div>
                    <p className="font-semibold">
                      {detail.from}{" "}
                      <span className="font-normal text-zinc-500">&lt;{detail.fromEmail}&gt;</span>
                    </p>
                    <p className="text-xs text-zinc-500">to me</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="text-xs">{formatWhen(detail.date)}</span>
                  <button type="button" onClick={() => startReply("reply")} className="rounded-lg p-1.5 hover:bg-white/5" title="Reply">
                    <Reply className="size-4" />
                  </button>
                  <button type="button" onClick={() => startReply("replyAll")} className="rounded-lg p-1.5 hover:bg-white/5" title="Reply all">
                    <ReplyAll className="size-4" />
                  </button>
                  <button type="button" onClick={() => startReply("forward")} className="rounded-lg p-1.5 hover:bg-white/5" title="Forward">
                    <Forward className="size-4" />
                  </button>
                  <button type="button" onClick={() => window.print()} className="rounded-lg p-1.5 hover:bg-white/5" title="Print">
                    <Printer className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {detail.html ? (
                <div
                  className="prose prose-invert max-w-none text-[0.95rem] leading-relaxed prose-a:text-[#f0d78c]"
                  dangerouslySetInnerHTML={{ __html: detail.html }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[0.95rem] leading-relaxed text-zinc-200">
                  {detail.text}
                </pre>
              )}

              {detail.attachments.length > 0 ? (
                <div className="mt-8">
                  <p className="mb-3 text-sm font-semibold">{detail.attachments.length} Attachments</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {detail.attachments.map((a) => (
                      <a
                        key={a.part}
                        href={`/api/webmail/messages/${detail.uid}/attachments/${a.part}?folder=${encodeURIComponent(folder)}`}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition hover:border-[#d4af37]/40",
                          light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#14141e]",
                        )}
                      >
                        <FileText className="size-5 text-[#d4af37]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.filename}</span>
                          <span className="text-xs text-zinc-500">{Math.round(a.size / 1024)} KB</span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/8 p-4">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#12121a] px-3 py-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#d4af37]/25 text-xs font-bold">
                  {initials(me?.name || "U")}
                </span>
                <button
                  type="button"
                  onClick={() => startReply("reply")}
                  className="flex-1 text-left text-sm text-zinc-500"
                >
                  Reply or forward…
                </button>
                <button
                  type="button"
                  onClick={() => startReply("reply")}
                  className="rounded-full bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] px-4 py-2 text-sm font-bold text-[#1a1200]"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Compose modal */}
      <AnimatePresence>
        {composeOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 sm:items-center sm:justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="flex h-[min(640px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#d4af37]/25 bg-[#0e0e16] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-[#12121a] px-4 py-3">
                <p className="font-semibold">New Message</p>
                <button type="button" onClick={() => setComposeOpen(false)} className="rounded-lg p-1 hover:bg-white/5">
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-2 border-b border-white/10 px-4 py-3">
                <input
                  value={compose.to}
                  onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
                  placeholder="To"
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/6"
                />
                <input
                  value={compose.subject}
                  onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                  placeholder="Subject"
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/6"
                />
              </div>
              <textarea
                value={compose.body}
                onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
                className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none"
                placeholder="Write your message…"
              />
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api("/api/webmail/messages/draft", {
                        method: "POST",
                        body: JSON.stringify({
                          to: compose.to,
                          subject: compose.subject,
                          text: compose.body,
                        }),
                      });
                      toast.success("Draft saved");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Draft failed");
                    }
                  }}
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={() => void sendCompose()}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] px-5 py-2 text-sm font-bold text-[#1a1200]"
                >
                  <Send className="size-3.5" />
                  Send
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
