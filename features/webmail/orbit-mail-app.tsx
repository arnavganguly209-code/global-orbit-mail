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
  ChevronLeft,
  ChevronRight,
  Forward,
  Inbox,
  LogOut,
  Mail,
  Menu,
  Moon,
  Paperclip,
  PenSquare,
  Pencil,
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
  Users,
  X,
  FileText,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { webmailRoutes } from "@/config/webmail-routes";
import { useLayoutMode } from "@/features/webmail/hooks/use-layout-mode";
import { ComposeWindow, type ComposeState } from "@/features/webmail/compose-window";
import {
  folderIconLabel,
  formatStorageMb,
  formatWhen,
  initials,
  isSystemFolder,
  webmailApi,
  type Folder,
  type Me,
  type MessageDetail,
  type MessageItem,
} from "@/features/webmail/lib/api";

type Pane = "folders" | "list" | "reader";

const PAGE_SIZE = 50;

const emptyCompose = (): ComposeState => ({
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  mode: "new",
  attachments: [],
});

export function OrbitMailApp({
  initialUid = null,
  openCompose = false,
}: {
  initialUid?: number | null;
  openCompose?: boolean;
} = {}) {
  const router = useRouter();
  const qc = useQueryClient();
  const layout = useLayoutMode();
  const { resolvedTheme, setTheme } = useTheme();
  const light = resolvedTheme === "light";

  const [folder, setFolder] = React.useState("INBOX");
  const [page, setPage] = React.useState(1);
  const [selectedUid, setSelectedUid] = React.useState<number | null>(initialUid);
  const [selectedUids, setSelectedUids] = React.useState<number[]>([]);
  const [query, setQuery] = React.useState("");
  const [searchQ, setSearchQ] = React.useState("");
  const [composeOpen, setComposeOpen] = React.useState(openCompose);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [pane, setPane] = React.useState<Pane>(initialUid != null ? "reader" : "list");
  const [compose, setCompose] = React.useState<ComposeState>(emptyCompose);
  const [moveTarget, setMoveTarget] = React.useState("");
  const [bulkMoveTarget, setBulkMoveTarget] = React.useState("");
  const [preview, setPreview] = React.useState<{ url: string; kind: "image" | "pdf" } | null>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [folderDialog, setFolderDialog] = React.useState<
    null | { mode: "create" } | { mode: "rename"; path: string; name: string }
  >(null);
  const [folderNameInput, setFolderNameInput] = React.useState("");
  const [folderBusy, setFolderBusy] = React.useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (initialUid != null) {
      setSelectedUid(initialUid);
      setPane("reader");
    }
  }, [initialUid]);

  React.useEffect(() => {
    if (openCompose) {
      setCompose(emptyCompose());
      setComposeOpen(true);
    }
  }, [openCompose]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const to = new URLSearchParams(window.location.search).get("to");
    if (to && openCompose) {
      setCompose((c) => ({ ...c, to }));
    }
  }, [openCompose]);

  React.useEffect(() => {
    if (!notifOpen) return;
    function onDoc(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [notifOpen]);

  const meQuery = useQuery({
    queryKey: ["webmail", "me"],
    queryFn: () => webmailApi<Me>("/api/webmail/auth/me"),
    staleTime: 60_000,
    retry: 1,
  });

  React.useEffect(() => {
    if (meQuery.isError) {
      toast.error("Session expired");
      router.replace(webmailRoutes.home);
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
    queryKey: ["webmail", "messages", folder, searchQ, page],
    queryFn: async () => {
      if (searchQ.trim()) {
        const data = await webmailApi<{ messages: MessageItem[] }>(
          `/api/webmail/search?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(searchQ)}`,
        );
        return { messages: data.messages, total: data.messages.length, page: 1, pageSize: data.messages.length };
      }
      return webmailApi<{ messages: MessageItem[]; total: number; page: number; pageSize: number }>(
        `/api/webmail/messages?folder=${encodeURIComponent(folder)}&page=${page}&pageSize=${PAGE_SIZE}`,
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
  const systemFolders = folders.filter(isSystemFolder);
  const customFolders = folders.filter((f) => !isSystemFolder(f));
  const messages = messagesQuery.data?.messages ?? [];
  const total = messagesQuery.data?.total ?? 0;
  const me = meQuery.data ?? null;
  const displayName = me?.branding?.displayName || me?.name || "";
  const detail = selectedUid != null ? (detailQuery.data ?? null) : null;
  const inboxUnseen = folders.find((f) => f.path.toUpperCase() === "INBOX")?.unseen ?? 0;
  const folderLabel =
    folderIconLabel(folders.find((f) => f.path === folder) || { path: folder, name: folder, unseen: 0, messages: 0 }) ||
    folder;

  const quotaMb = me?.branding?.quotaMb ?? 0;
  const usedMb = me?.branding?.usedMb ?? 0;
  const usedPct = quotaMb > 0 ? Math.min(100, (usedMb / quotaMb) * 100) : 0;

  const isStack = layout === "mobile" || layout === "tablet";
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

  const searching = Boolean(searchQ.trim());
  const totalPages = searching ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : searching ? 1 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = searching ? messages.length : Math.min(page * PAGE_SIZE, total);
  const allPageSelected = messages.length > 0 && messages.every((m) => selectedUids.includes(m.uid));

  function selectFolder(path: string) {
    setFolder(path);
    setPage(1);
    setSelectedUid(null);
    setSelectedUids([]);
    setSearchQ("");
    setQuery("");
    setDrawerOpen(false);
    if (isStack) setPane("list");
    router.push(webmailRoutes.mail, { scroll: false });
  }

  async function openMessage(uid: number) {
    setSelectedUid(uid);
    if (isStack) setPane("reader");
    router.push(webmailRoutes.message(uid), { scroll: false });
    qc.setQueryData<{ messages: MessageItem[]; total: number }>(
      ["webmail", "messages", folder, searchQ, page],
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

  async function runAction(action: string, uids: number[], extra?: Record<string, unknown>) {
    if (uids.length === 0) return;
    try {
      await webmailApi("/api/webmail/messages/action", {
        method: "POST",
        body: JSON.stringify({ action, folder, uids, ...extra }),
      });
      toast.success(
        action === "delete"
          ? uids.length > 1
            ? `Deleted ${uids.length}`
            : "Deleted"
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
        if (selectedUid != null && uids.includes(selectedUid)) {
          setSelectedUid(null);
          router.push(webmailRoutes.mail, { scroll: false });
          if (isStack) setPane("list");
        }
        setSelectedUids((prev) => prev.filter((id) => !uids.includes(id)));
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

  function toggleSelect(uid: number) {
    setSelectedUids((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  }

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedUids((prev) => prev.filter((id) => !messages.some((m) => m.uid === id)));
    } else {
      setSelectedUids((prev) => Array.from(new Set([...prev, ...messages.map((m) => m.uid)])));
    }
  }

  async function toggleFlag(m: MessageItem, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const next = !m.flagged;
    qc.setQueryData<{ messages: MessageItem[]; total: number }>(
      ["webmail", "messages", folder, searchQ, page],
      (prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((row) =>
                row.uid === m.uid ? { ...row, flagged: next } : row,
              ),
            }
          : prev,
    );
    await runAction("flag", [m.uid], { flagged: next });
  }

  async function logout() {
    await fetch("/api/webmail/auth/logout", { method: "POST" });
    router.replace(webmailRoutes.home);
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

  function openCreateFolder() {
    setFolderNameInput("");
    setFolderDialog({ mode: "create" });
  }

  function openRenameFolder(f: Folder) {
    setFolderNameInput(f.name);
    setFolderDialog({ mode: "rename", path: f.path, name: f.name });
  }

  async function submitFolderDialog() {
    const name = folderNameInput.trim();
    if (!name) {
      toast.error("Folder name required");
      return;
    }
    setFolderBusy(true);
    try {
      if (folderDialog?.mode === "create") {
        await webmailApi("/api/webmail/folders", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        toast.success("Folder created");
      } else if (folderDialog?.mode === "rename") {
        await webmailApi("/api/webmail/folders", {
          method: "PATCH",
          body: JSON.stringify({ from: folderDialog.path, to: name }),
        });
        if (folder === folderDialog.path) setFolder(name);
        toast.success("Folder renamed");
      }
      setFolderDialog(null);
      await qc.invalidateQueries({ queryKey: ["webmail", "folders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Folder action failed");
    } finally {
      setFolderBusy(false);
    }
  }

  async function deleteCustomFolder(f: Folder) {
    if (!window.confirm(`Delete folder “${f.name}”? Messages in it may be removed.`)) return;
    try {
      await webmailApi("/api/webmail/folders", {
        method: "DELETE",
        body: JSON.stringify({ path: f.path }),
      });
      toast.success("Folder deleted");
      if (folder === f.path) selectFolder("INBOX");
      await qc.invalidateQueries({ queryKey: ["webmail", "folders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
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

  function renderFolderButton(f: Folder, opts?: { custom?: boolean }) {
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
      <div key={f.path} className="group relative mb-0.5">
        <button
          type="button"
          onClick={() => selectFolder(f.path)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors duration-150",
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
        {opts?.custom ? (
          <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md bg-[#12121a]/95 p-0.5 group-hover:flex">
            <button
              type="button"
              title="Rename"
              className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                openRenameFolder(f);
              }}
            >
              <Pencil className="size-3" />
            </button>
            <button
              type="button"
              title="Delete"
              className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-red-300"
              onClick={(e) => {
                e.stopPropagation();
                void deleteCustomFolder(f);
              }}
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const sidebar = (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r",
        sidebarWidth,
        light ? "border-slate-200 bg-white/90 backdrop-blur-xl" : "border-white/[0.07] bg-[#0b0b11]/95 backdrop-blur-xl",
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
          className={cn("mx-auto h-auto w-auto bg-transparent object-contain", layout === "laptop" ? "max-w-[150px]" : "max-w-[180px]")}
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
          : systemFolders.map((f) => renderFolderButton(f))}

        <div className="mt-4 flex items-center justify-between px-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-zinc-500">Folders</p>
          <button
            type="button"
            onClick={openCreateFolder}
            className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-[#f0d78c]"
            title="Create folder"
            aria-label="Create folder"
          >
            <FolderPlus className="size-3.5" />
          </button>
        </div>
        {customFolders.length === 0 ? (
          <p className="px-3 pt-2 text-xs text-zinc-600">No custom folders yet.</p>
        ) : (
          customFolders.map((f) => renderFolderButton(f, { custom: true }))
        )}
      </nav>

      <div
        className={cn(
          "mx-3 mb-3 rounded-xl border p-3",
          light ? "border-slate-200 bg-slate-50/90" : "border-white/8 bg-[#12121a]/90",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{displayName || "…"}</p>
          {me?.online ? (
            <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-emerald-400">
              <i className="size-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{me?.email || "…"}</p>
        {quotaMb > 0 ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[0.7rem] text-zinc-500">
              <span>Storage</span>
              <span>
                {formatStorageMb(usedMb)} / {formatStorageMb(quotaMb)}
              </span>
            </div>
            <div className={cn("h-1.5 overflow-hidden rounded-full", light ? "bg-slate-200" : "bg-white/10")}>
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usedPct >= 90 ? "bg-red-400" : usedPct >= 75 ? "bg-amber-400" : "bg-[#d4af37]",
                )}
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-around border-t border-white/8 px-2 py-3">
        <button
          type="button"
          onClick={() => router.push(webmailRoutes.settings)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
          title="Settings"
        >
          <Settings className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => router.push(webmailRoutes.contacts)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
          title="Contacts"
        >
          <Users className="size-4" />
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
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
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
            </button>
            {notifOpen ? (
              <div
                className={cn(
                  "absolute right-0 top-10 z-20 w-64 rounded-xl border p-4 text-sm shadow-xl",
                  light ? "border-slate-200 bg-white text-slate-700" : "border-white/10 bg-[#12121a] text-zinc-300",
                )}
              >
                <p className="font-semibold text-[#f0d78c]">Notifications</p>
                <p className="mt-2 text-zinc-500">No notifications</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold tracking-tight">
          {folderLabel}{" "}
          <span className="text-[#f0d78c]">
            {folder.toUpperCase() === "INBOX" ? inboxUnseen || total : total}
          </span>
        </h2>
        <button
          type="button"
          onClick={() => void messagesQuery.refetch()}
          className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/5"
        >
          ↻
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={toggleSelectAllPage}
            className="size-3.5 accent-[#d4af37]"
            aria-label="Select all on page"
          />
          Select all
        </label>
        {selectedUids.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-zinc-500">{selectedUids.length} selected</span>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5"
              title="Archive"
              onClick={() => void runAction("archive", selectedUids)}
            >
              <Archive className="size-3.5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5"
              title="Delete"
              onClick={() => void runAction("delete", selectedUids)}
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5"
              title="Spam"
              onClick={() => void runAction("spam", selectedUids)}
            >
              <ShieldAlert className="size-3.5" />
            </button>
            <select
              value={bulkMoveTarget}
              onChange={(e) => setBulkMoveTarget(e.target.value)}
              className="h-7 max-w-[110px] rounded-lg border border-white/10 bg-transparent px-1 text-[0.7rem]"
            >
              <option value="">Move…</option>
              {folders.map((f) => (
                <option key={f.path} value={f.path}>
                  {folderIconLabel(f)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!bulkMoveTarget}
              className="rounded-lg px-2 py-1 text-[0.7rem] hover:bg-white/5 disabled:opacity-40"
              onClick={() => void runAction("move", selectedUids, { target: bulkMoveTarget })}
            >
              Go
            </button>
          </div>
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
                  const checked = selectedUids.includes(m.uid);
                  return (
                    <div
                      key={m.uid}
                      className={cn(
                        "orbit-mail-row mb-1.5 flex w-full gap-2 rounded-xl border px-2 py-3 text-left transition-colors duration-100",
                        active
                          ? "border-[#d4af37]/55 bg-[rgba(212,175,55,0.12)]"
                          : light
                            ? "border-transparent hover:bg-slate-50"
                            : "border-transparent hover:bg-white/[0.03]",
                        m.unseen && "font-semibold",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(m.uid)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 size-3.5 shrink-0 accent-[#d4af37]"
                        aria-label={`Select ${m.subject || "message"}`}
                      />
                      <button
                        type="button"
                        onMouseEnter={() => prefetchMessage(m.uid)}
                        onFocus={() => prefetchMessage(m.uid)}
                        onClick={() => void openMessage(m.uid)}
                        className="flex min-w-0 flex-1 gap-3 text-left"
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
                      </button>
                      <button
                        type="button"
                        className="mt-1 shrink-0 rounded p-1 hover:bg-white/5"
                        onClick={(e) => void toggleFlag(m, e)}
                        aria-label={m.flagged ? "Unstar" : "Star"}
                      >
                        <Star
                          className={cn(
                            "size-3.5",
                            m.flagged ? "fill-[#d4af37] text-[#d4af37]" : "text-zinc-600",
                          )}
                        />
                      </button>
                    </div>
                  );
                })
              )}
      </div>

      <div className="flex items-center justify-between border-t border-white/8 px-4 py-2 text-xs text-zinc-500">
        <span>
          {total === 0 ? "0" : `${rangeStart}–${rangeEnd}`} of {total}
        </span>
        {!searching ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md p-1 hover:bg-white/5 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span>
              {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md p-1 hover:bg-white/5 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
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
            { label: "Archive", icon: Archive, fn: () => runAction("archive", selectedUid ? [selectedUid] : []) },
            { label: "Delete", icon: Trash2, fn: () => runAction("delete", selectedUid ? [selectedUid] : []) },
            { label: "Spam", icon: ShieldAlert, fn: () => runAction("spam", selectedUid ? [selectedUid] : []) },
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
                onClick={() => void runAction("seen", [selectedUid], { seen: false })}
                title="Mark unread"
              >
                Unread
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"
                onClick={() => {
                  const flagged = messages.find((m) => m.uid === selectedUid)?.flagged;
                  void runAction("flag", [selectedUid], { flagged: !flagged });
                }}
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
                    onClick={() => void runAction("move", [selectedUid], { target: moveTarget })}
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    disabled={!moveTarget}
                    className="rounded-lg px-2 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40"
                    onClick={() => void runAction("copy", [selectedUid], { target: moveTarget })}
                  >
                    Copy
                  </button>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="hidden min-w-0 text-right sm:block">
          <p className="truncate text-sm font-semibold">{displayName}</p>
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
                {initials(displayName || "U")}
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
                Reply
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
            <Image src="/brand/logo.png" alt="GLOBAL ORBIT" width={140} height={40} className="h-auto w-auto max-w-[132px] object-contain" />
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
            <button
              type="button"
              onClick={openCreateFolder}
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm text-[#f0d78c] hover:bg-white/5"
            >
              <FolderPlus className="size-4" />
              New folder
            </button>
          </div>
          <div className="flex items-center justify-around border-t border-white/8 py-3">
            <button type="button" onClick={() => router.push(webmailRoutes.settings)} className="rounded-lg p-2 text-zinc-400">
              <Settings className="size-4" />
            </button>
            <button type="button" onClick={() => router.push(webmailRoutes.contacts)} className="rounded-lg p-2 text-zinc-400">
              <Users className="size-4" />
            </button>
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
        signatureHtml={me?.branding?.signatureHtml}
        signatureText={me?.branding?.signatureText}
        onClose={() => {
          setComposeOpen(false);
          if (openCompose) router.push(webmailRoutes.mail);
        }}
        onSent={() => {
          setComposeOpen(false);
          setCompose(emptyCompose());
          void Promise.all([
            qc.invalidateQueries({ queryKey: ["webmail", "messages"] }),
            qc.invalidateQueries({ queryKey: ["webmail", "folders"] }),
            qc.invalidateQueries({ queryKey: ["webmail", "contacts"] }),
          ]);
          router.push(webmailRoutes.mail);
        }}
      />

      {folderDialog ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e0e16] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">
                {folderDialog.mode === "create" ? "Create folder" : "Rename folder"}
              </h3>
              <button type="button" onClick={() => setFolderDialog(null)} className="rounded-lg p-1 hover:bg-white/5">
                <X className="size-4" />
              </button>
            </div>
            <input
              autoFocus
              value={folderNameInput}
              onChange={(e) => setFolderNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitFolderDialog();
              }}
              placeholder="Folder name"
              className="mb-4 h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/6"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolderDialog(null)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={folderBusy}
                onClick={() => void submitFolderDialog()}
                className="rounded-full bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] px-4 py-2 text-sm font-bold text-[#1a1200] disabled:opacity-60"
              >
                {folderBusy ? "Saving…" : folderDialog.mode === "create" ? "Create" : "Rename"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
