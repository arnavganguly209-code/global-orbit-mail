"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArrowLeft,
  Bell,
  ChevronDown,
  Forward,
  Inbox,
  LogOut,
  Mail,
  Menu,
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
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/features/webmail/hooks/use-layout-mode";
import { ComposeWindow, type ComposeState } from "@/features/webmail/compose-window";
import {
  folderIconLabel,
  formatWhen,
  initials,
  webmailApi,
  type Folder,
  type Me,
  type MessageDetail,
  type MessageItem,
} from "@/features/webmail/lib/api";

type Pane = "folders" | "list" | "reader";

const emptyCompose = (): ComposeState => ({
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  mode: "new",
  attachments: [],
});

export function OrbitMailApp() {
  const router = useRouter();
  const qc = useQueryClient();
  const layout = useLayoutMode();
  const { resolvedTheme, setTheme } = useTheme();
  const light = resolvedTheme === "light";

  const [folder, setFolder] = React.useState("INBOX");
  const [selectedUid, setSelectedUid] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState("");
  const [searchQ, setSearchQ] = React.useState("");
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [pane, setPane] = React.useState<Pane>("list");
  const [compose, setCompose] = React.useState<ComposeState>(emptyCompose);
  const [moveTarget, setMoveTarget] = React.useState("");
  const [preview, setPreview] = React.useState<{ url: string; kind: "image" | "pdf" } | null>(null);

  const meQuery = useQuery({
    queryKey: ["webmail", "me"],
    queryFn: () => webmailApi<Me>("/api/webmail/auth/me"),
    staleTime: 60_000,
    retry: 1,
  });

  React.useEffect(() => {
    if (meQuery.isError) {
      toast.error("Session expired");
      router.replace("/webmail/login");
    }
  }, [meQuery.isError, router]);

  const foldersQuery = useQuery({
    queryKey: ["webmail", "folders"],
    queryFn: async () => {
      const data = await webmailApi<{ folders: Folder[] }>("/api/webmail/folders");
      return data.folders;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    enabled: !!meQuery.data,
  });

  const messagesQuery = useQuery({
    queryKey: ["webmail", "messages", folder, searchQ],
    queryFn: async () => {
      if (searchQ.trim()) {
        const data = await webmailApi<{ messages: MessageItem[] }>(
          `/api/webmail/search?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(searchQ)}`,
        );
        return { messages: data.messages, total: data.messages.length };
      }
      return webmailApi<{ messages: MessageItem[]; total: number }>(
        `/api/webmail/messages?folder=${encodeURIComponent(folder)}&page=1`,
      );
    },
    staleTime: 8_000,
    refetchInterval: 20_000,
    placeholderData: keepPreviousData,
    enabled: !!meQuery.data,
  });

  const contactsQuery = useQuery({
    queryKey: ["webmail", "contacts"],
    queryFn: () => webmailApi<{ recent: string[] }>("/api/webmail/contacts"),
    staleTime: 120_000,
    enabled: !!meQuery.data,
  });

  const detailQuery = useQuery({
    queryKey: ["webmail", "message", folder, selectedUid],
    queryFn: () =>
      webmailApi<MessageDetail>(
        `/api/webmail/messages/${selectedUid}?folder=${encodeURIComponent(folder)}`,
      ),
    staleTime: 60_000,
    enabled: selectedUid != null,
    placeholderData: keepPreviousData,
  });

  if (!layout) {
    return <div className="h-dvh bg-[#050508]" aria-hidden />;
  }

  const folders = foldersQuery.data ?? [];
  const messages = messagesQuery.data?.messages ?? [];
  const total = messagesQuery.data?.total ?? 0;
  const me = meQuery.data ?? null;
  const detail = selectedUid != null ? (detailQuery.data ?? null) : null;
  const inboxUnseen = folders.find((f) => f.path.toUpperCase() === "INBOX")?.unseen ?? 0;
  const folderLabel =
    folderIconLabel(folders.find((f) => f.path === folder) || { path: folder, name: folder, unseen: 0, messages: 0 }) ||
    folder;

  const isStack = layout === "mobile" || layout === "tablet";
  /** Desktop/laptop: persistent rail. Tablet: drawer overlay. Mobile: dedicated folders pane. */
  const showSidebar =
    layout === "desktop" || layout === "laptop" || (layout === "tablet" && drawerOpen);
  const showList =
    layout === "desktop" ||
    layout === "laptop" ||
    (layout === "tablet" && pane !== "reader") ||
    (layout === "mobile" && pane === "list");
  const showReader =
    layout === "desktop" || layout === "laptop" || (isStack && pane === "reader");
  const showMobileFolders = layout === "mobile" && pane === "folders";

  function selectFolder(path: string) {
    setFolder(path);
    setSelectedUid(null);
    setSearchQ("");
    setQuery("");
    setDrawerOpen(false);
    if (isStack) setPane("list");
  }

  async function openMessage(uid: number) {
    setSelectedUid(uid);
    if (isStack) setPane("reader");
    // Mark seen optimistically + persist to IMAP
    qc.setQueryData<{ messages: MessageItem[]; total: number }>(
      ["webmail", "messages", folder, searchQ],
      (prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) => (m.uid === uid ? { ...m, unseen: false } : m)),
            }
          : prev,
    );
    try {
      await webmailApi("/api/webmail/messages/action", {
        method: "POST",
        body: JSON.stringify({ action: "seen", folder, uids: [uid], seen: true }),
      });
      void qc.invalidateQueries({ queryKey: ["webmail", "folders"] });
    } catch {
      /* non-blocking */
    }
  }

  function prefetchMessage(uid: number) {
    void qc.prefetchQuery({
      queryKey: ["webmail", "message", folder, uid],
      queryFn: () =>
        webmailApi<MessageDetail>(
          `/api/webmail/messages/${uid}?folder=${encodeURIComponent(folder)}`,
        ),
      staleTime: 60_000,
    });
  }

  async function runAction(action: string, extra?: Record<string, unknown>) {
    if (!selectedUid) return;
    try {
      await webmailApi("/api/webmail/messages/action", {
        method: "POST",
        body: JSON.stringify({ action, folder, uids: [selectedUid], ...extra }),
      });
      toast.success(
        action === "delete"
          ? "Deleted"
          : action === "archive"
            ? "Archived"
            : action === "spam"
              ? "Moved to Spam"
              : action === "flag"
                ? extra?.flagged
                  ? "Starred"
                  : "Unstarred"
                : action === "seen"
                  ? extra?.seen === false
                    ? "Marked unread"
                    : "Marked read"
                  : action === "move"
                    ? "Moved"
                    : action === "copy"
                      ? "Copied"
                      : "Done",
      );
      if (action === "delete" || action === "archive" || action === "spam" || action === "move") {
        setSelectedUid(null);
        if (isStack) setPane("list");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["webmail", "messages"] }),
        qc.invalidateQueries({ queryKey: ["webmail", "folders"] }),
        qc.invalidateQueries({ queryKey: ["webmail", "message"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
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
          ? [detail.fromEmail, ...detail.to.split(",").map((s) => s.trim())]
              .filter((e) => e && e.toLowerCase() !== (me?.email || "").toLowerCase())
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(", ")
          : detail.fromEmail;
    const cc =
      mode === "replyAll"
        ? detail.cc
            .split(",")
            .map((s) => s.trim())
            .filter((e) => e && e.toLowerCase() !== (me?.email || "").toLowerCase())
            .join(", ")
        : "";
    const subjectPrefix = mode === "forward" ? "Fwd: " : "Re: ";
    const subject =
      detail.subject.startsWith("Re:") || detail.subject.startsWith("Fwd:")
        ? detail.subject
        : `${subjectPrefix}${detail.subject}`;
    const quoted = `\n\n----------\nOn ${detail.date || ""}, ${detail.from} <${detail.fromEmail}> wrote:\n${detail.text || ""}`;
    setCompose({
      to,
      cc,
      bcc: "",
      subject,
      body: mode === "forward" ? detail.text || detail.html?.replace(/<[^>]+>/g, " ") || "" : quoted,
      mode,
      inReplyTo: detail.messageId,
      references: detail.messageId,
      attachments: [],
    });
    setComposeOpen(true);
  }

  const recentRecipients = contactsQuery.data?.recent ?? [];
  const sidebarWidth =
    layout === "desktop" ? "w-[272px]" : layout === "laptop" ? "w-[232px]" : "w-[min(320px,86vw)]";
  const listWidth =
    layout === "desktop" ? "w-[420px]" : layout === "laptop" ? "w-[340px]" : "w-full";

  const shell = cn(
    "orbit-mail-shell flex h-dvh overflow-hidden font-sans antialiased",
    light ? "bg-[#f4f5f8] text-slate-900" : "bg-[#050508] text-[#f5f5f7]",
  );

  const sidebar = (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r",
        sidebarWidth,
        light ? "border-slate-200 bg-white" : "border-white/[0.07] bg-[#0b0b11]",
        isStack && "fixed inset-y-0 left-0 z-40 shadow-2xl",
      )}
    >
      <div className={cn("px-4 pb-1 pt-4", layout === "laptop" && "px-3")}>
        <Image
          src="/brand/logo.png"
          alt="GLOBAL ORBIT PVT LTD"
          width={200}
          height={56}
          priority
          className={cn("mx-auto h-auto", layout === "laptop" ? "w-[150px]" : "w-[180px]")}
        />
      </div>

      <button
        type="button"
          onClick={() => {
            setCompose(emptyCompose());
            setComposeOpen(true);
            setDrawerOpen(false);
          }}
          className="mx-3 mb-3 mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] px-4 py-3 text-sm font-bold text-[#1a1200] shadow-[0_8px_22px_rgba(212,175,55,0.28)] transition hover:brightness-105 active:scale-[0.99]"
        >
          <PenSquare className="size-4" />
          Compose
        </button>

      <nav className="orbit-scroll flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        <p className="mb-1 px-3 pt-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#d4af37]/85">
          Mailbox
        </p>
        {foldersQuery.isLoading && folders.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mb-1 h-10 animate-pulse rounded-[10px] bg-white/5" />
            ))
          : folders.map((f) => {
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
                  onClick={() => selectFolder(f.path)}
                  className={cn(
                    "mb-0.5 flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors duration-150",
                    active
                      ? "bg-[rgba(212,175,55,0.18)] font-semibold text-[#f0d78c] shadow-[inset_3px_0_0_#d4af37]"
                      : light
                        ? "text-slate-600 hover:bg-amber-50"
                        : "text-zinc-400 hover:bg-[rgba(212,175,55,0.1)] hover:text-white",
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

        <div className="mt-4 flex items-center justify-between px-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-zinc-500">Folders</p>
          <FolderPlus className="size-3.5 text-zinc-500" />
        </div>
        <p className="px-3 pt-2 text-xs text-zinc-600">Custom folders appear after IMAP sync.</p>
      </nav>

      <div
        className={cn(
          "mx-3 mb-3 rounded-xl border p-3",
          light ? "border-slate-200 bg-slate-50" : "border-white/8 bg-[#12121a]",
        )}
      >
        <p className="text-xs text-zinc-400">Mailbox</p>
        <p className="mt-1 truncate text-sm font-medium">{me?.email || "…"}</p>
        <p className="mt-1 text-[0.7rem] text-zinc-500">IMAP sync · {folders.length} folders</p>
      </div>

      <div className="flex items-center justify-around border-t border-white/8 px-2 py-3">
        <button type="button" className="rounded-lg p-2 text-zinc-400 hover:bg-white/5" title="Settings">
          <Settings className="size-4" />
        </button>
        <button type="button" className="rounded-lg p-2 text-zinc-400 hover:bg-white/5" title="Help">
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
        <button type="button" onClick={() => void logout()} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5" title="Logout">
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );

  const listPane = (
    <section
      className={cn(
        "flex min-h-0 shrink-0 flex-col border-r",
        listWidth,
        isStack && "min-w-0 flex-1 border-r-0",
        light ? "border-slate-200 bg-white" : "border-white/[0.07] bg-[#0a0a10]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-3">
        {isStack ? (
          <button
            type="button"
            onClick={() => {
              if (layout === "mobile") setPane("folders");
              else setDrawerOpen(true);
            }}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
            aria-label="Open folders"
          >
            <Menu className="size-5" />
          </button>
        ) : null}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
          <i className="size-1.5 rounded-full bg-emerald-400" />
          Online
          <ChevronDown className="size-3 opacity-60" />
        </span>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearchQ(query.trim());
          }}
          className="relative min-w-0 flex-1"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              layout === "mobile" ? "Search" : "Search… from: to: since: has:attachment"
            }
            className={cn(
              "h-9 w-full rounded-xl border pl-9 pr-3 text-sm outline-none focus:border-[#d4af37]/70",
              light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#0a0a12] text-white",
            )}
          />
        </form>
        {layout !== "mobile" ? (
          <button type="button" className="relative rounded-lg p-2 text-zinc-400 hover:bg-white/5">
            <Bell className="size-4" />
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-[#d4af37]" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold tracking-tight">
          {folderLabel}{" "}
          <span className="text-[#f0d78c]">{folder.toUpperCase() === "INBOX" ? inboxUnseen || total : total}</span>
        </h2>
        <button
          type="button"
          onClick={() => void messagesQuery.refetch()}
          className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/5"
        >
          ↻
        </button>
      </div>

      <div className="flex gap-4 border-b border-white/8 px-4 text-sm">
        <span className="border-b-2 border-[#d4af37] pb-2 font-semibold text-[#f0d78c]">Primary</span>
        {layout !== "mobile" ? (
          <>
            <span className="pb-2 text-zinc-500">Social</span>
            <span className="pb-2 text-zinc-500">Promotions</span>
          </>
        ) : null}
      </div>

      <div className="orbit-scroll flex-1 overflow-y-auto overscroll-contain px-2 py-2 [content-visibility:auto]">
        {messagesQuery.isLoading && messages.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-1.5 h-[72px] animate-pulse rounded-xl bg-white/[0.04]" />
            ))
          : messages.length === 0
            ? (
                <p className="p-4 text-sm text-zinc-500">No messages</p>
              )
            : (
                messages.map((m) => {
                  const active = m.uid === selectedUid;
                  return (
                    <button
                      key={m.uid}
                      type="button"
                      onMouseEnter={() => prefetchMessage(m.uid)}
                      onFocus={() => prefetchMessage(m.uid)}
                      onClick={() => void openMessage(m.uid)}
                      className={cn(
                        "orbit-mail-row mb-1.5 flex w-full gap-3 rounded-xl border px-3 py-3 text-left transition-colors duration-100",
                        active
                          ? "border-[#d4af37]/55 bg-[rgba(212,175,55,0.12)]"
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
                        <span className="mt-0.5 block truncate text-sm">{m.subject || "(no subject)"}</span>
                        <span className="mt-0.5 flex items-center gap-1 truncate text-xs font-normal text-zinc-500">
                          {m.hasAttachment ? <Paperclip className="size-3" /> : null}
                          {m.preview || " "}
                        </span>
                      </span>
                      <Star
                        className={cn(
                          "mt-1 size-3.5 shrink-0",
                          m.flagged ? "fill-[#d4af37] text-[#d4af37]" : "text-zinc-600",
                        )}
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
  );

  const readerPane = (
    <section className={cn("flex min-w-0 flex-1 flex-col", light ? "bg-white" : "bg-[#0a0a10]")}>
      <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-0.5 text-sm text-zinc-400">
          {isStack ? (
            <button
              type="button"
              onClick={() => {
                setSelectedUid(null);
                setPane("list");
              }}
              className="mr-1 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-white/5"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          ) : null}
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
              {layout === "mobile" ? null : a.label}
            </button>
          ))}
          {selectedUid ? (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"
                onClick={() => void runAction("seen", { seen: false })}
                title="Mark unread"
              >
                Unread
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"
                onClick={() =>
                  void runAction("flag", { flagged: !(detail?.uid === selectedUid && messages.find((m) => m.uid === selectedUid)?.flagged) })
                }
                title="Star"
              >
                <Star className="size-3.5" />
              </button>
              {layout !== "mobile" ? (
                <span className="ml-1 inline-flex items-center gap-1">
                  <select
                    value={moveTarget}
                    onChange={(e) => setMoveTarget(e.target.value)}
                    className="h-8 rounded-lg border border-white/10 bg-transparent px-2 text-xs"
                  >
                    <option value="">Move to…</option>
                    {folders.map((f) => (
                      <option key={f.path} value={f.path}>
                        {folderIconLabel(f)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!moveTarget}
                    className="rounded-lg px-2 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40"
                    onClick={() => void runAction("move", { target: moveTarget })}
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    disabled={!moveTarget}
                    className="rounded-lg px-2 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40"
                    onClick={() => void runAction("copy", { target: moveTarget })}
                  >
                    Copy
                  </button>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="hidden min-w-0 text-right sm:block">
          <p className="truncate text-sm font-semibold">{me?.name}</p>
          <p className="truncate text-xs text-zinc-500">{me?.email}</p>
        </div>
      </div>

      {!selectedUid ? (
        <div className="flex flex-1 flex-col items-center justify-center text-zinc-500">
          <Mail className="mb-3 size-10 opacity-40" />
          <p className="text-sm">Select a message to read</p>
        </div>
      ) : detailQuery.isLoading && !detail ? (
        <div className="flex-1 space-y-4 p-6">
          <div className="h-8 w-2/3 animate-pulse rounded bg-white/5" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
          <div className="mt-8 h-40 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      ) : detail ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-white/8 px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-bold leading-snug sm:text-xl">{detail.subject || "(no subject)"}</h1>
              <span className="shrink-0 rounded-full bg-[#d4af37]/20 px-2 py-0.5 text-xs font-semibold text-[#f0d78c]">
                {folderLabel}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37]/50 to-[#1e5fa1]/50 text-sm font-bold">
                  {initials(detail.from)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {detail.from}{" "}
                    <span className="font-normal text-zinc-500">&lt;{detail.fromEmail}&gt;</span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    to {detail.to || "me"}
                    {detail.cc ? ` · cc ${detail.cc}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-zinc-400">
                <span className="mr-1 text-xs">{formatWhen(detail.date)}</span>
                <button type="button" onClick={() => startReply("reply")} className="rounded-lg p-1.5 hover:bg-white/5" title="Reply">
                  <Reply className="size-4" />
                </button>
                <button type="button" onClick={() => startReply("replyAll")} className="rounded-lg p-1.5 hover:bg-white/5" title="Reply all">
                  <ReplyAll className="size-4" />
                </button>
                <button type="button" onClick={() => startReply("forward")} className="rounded-lg p-1.5 hover:bg-white/5" title="Forward">
                  <Forward className="size-4" />
                </button>
                {layout !== "mobile" ? (
                  <button type="button" onClick={() => window.print()} className="rounded-lg p-1.5 hover:bg-white/5" title="Print">
                    <Printer className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="orbit-scroll flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {detail.html ? (
              <div
                className="orbit-mail-body prose prose-invert max-w-none text-[0.95rem] leading-relaxed prose-a:text-[#f0d78c]"
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
                  {detail.attachments.map((a) => {
                    const href = `/api/webmail/messages/${detail.uid}/attachments/${a.part}?folder=${encodeURIComponent(folder)}`;
                    const isImage = /^image\//i.test(a.contentType) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(a.filename);
                    const isPdf = /pdf/i.test(a.contentType) || /\.pdf$/i.test(a.filename);
                    return (
                      <div
                        key={a.part}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm",
                          light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#14141e]",
                        )}
                      >
                        <FileText className="size-5 shrink-0 text-[#d4af37]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.filename}</span>
                          <span className="text-xs text-zinc-500">{Math.round(a.size / 1024)} KB</span>
                        </span>
                        {isImage || isPdf ? (
                          <button
                            type="button"
                            className="shrink-0 text-xs font-medium text-[#d4af37] hover:underline"
                            onClick={() => setPreview({ url: href, kind: isPdf ? "pdf" : "image" })}
                          >
                            Preview
                          </button>
                        ) : null}
                        <a href={href} download={a.filename} className="shrink-0 text-xs font-medium text-zinc-400 hover:text-white">
                          Download
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/8 p-3 sm:p-4">
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
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Unable to load message</div>
      )}
    </section>
  );

  return (
    <div className={shell} data-layout={layout}>
      {isStack && drawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50"
          aria-label="Close folders"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      {showSidebar ? sidebar : null}

      {showMobileFolders ? (
        <div className="flex min-w-0 flex-1 flex-col bg-[#0b0b11]">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <Image src="/brand/logo.png" alt="GLOBAL ORBIT" width={140} height={40} className="h-auto w-[132px]" />
            <button type="button" onClick={() => setPane("list")} className="rounded-lg p-2 hover:bg-white/5">
              <X className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setCompose(emptyCompose());
              setComposeOpen(true);
            }}
            className="mx-4 my-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] px-4 py-3 text-sm font-bold text-[#1a1200]"
          >
            <PenSquare className="size-4" />
            Compose
          </button>
          <div className="orbit-scroll flex-1 overflow-y-auto p-2">
            {folders.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => selectFolder(f.path)}
                className="mb-1 flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left hover:bg-white/5"
              >
                <span className="font-medium">{folderIconLabel(f)}</span>
                {f.unseen > 0 ? (
                  <span className="rounded-full bg-[#d4af37] px-2 text-xs font-bold text-[#1a1200]">{f.unseen}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-around border-t border-white/8 py-3">
            <button type="button" onClick={() => setTheme(light ? "dark" : "light")} className="rounded-lg p-2 text-zinc-400">
              {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            <button type="button" onClick={() => void logout()} className="rounded-lg p-2 text-zinc-400">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {showList ? listPane : null}
          {showReader ? readerPane : null}
        </>
      )}

      <ComposeWindow
        open={composeOpen}
        initial={compose}
        recentRecipients={recentRecipients}
        mobile={layout === "mobile"}
        onClose={() => setComposeOpen(false)}
        onSent={() => {
          setComposeOpen(false);
          setCompose(emptyCompose());
          void Promise.all([
            qc.invalidateQueries({ queryKey: ["webmail", "messages"] }),
            qc.invalidateQueries({ queryKey: ["webmail", "folders"] }),
            qc.invalidateQueries({ queryKey: ["webmail", "contacts"] }),
          ]);
        }}
      />

      {preview ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div
            className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-white/15 bg-[#0e0e16]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-2 top-2 z-10 rounded-lg bg-black/50 p-2 text-white hover:bg-black/70"
              onClick={() => setPreview(null)}
            >
              <X className="size-4" />
            </button>
            {preview.kind === "pdf" ? (
              <iframe title="Attachment preview" src={preview.url} className="h-[85vh] w-full bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt="Attachment preview" className="max-h-[85vh] w-full object-contain" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
