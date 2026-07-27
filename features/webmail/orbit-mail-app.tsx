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
  Clock,
  Code2,
  FileDown,
  Filter,
  Forward,
  HelpCircle,
  Inbox,
  LogOut,
  Mail,
  Menu,
  Moon,
  MoreHorizontal,
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
  FolderPlus,
  CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { webmailRoutes } from "@/config/webmail-routes";
import { useLayoutMode } from "@/features/webmail/hooks/use-layout-mode";
import { ComposeWindow, type ComposeState } from "@/features/webmail/compose-window";
import {
  SYSTEM_NAV,
  matchSystemFolder,
  isReservedSystemPath,
  type SystemNavKey,
} from "@/features/webmail/system-nav";
import {
  folderIconLabel,
  formatStorageMb,
  formatWhen,
  initials,
  webmailApi,
  type Folder,
  type Me,
  type MessageDetail,
  type MessageItem,
  type ThreadItem,
} from "@/features/webmail/lib/api";

type Pane = "folders" | "list" | "reader";

const PAGE_SIZE = 50;
const STARRED_VIRTUAL = "__starred__";

const NAV_ICONS: Record<SystemNavKey, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  inbox: Inbox,
  starred: Star,
  important: CircleAlert,
  snoozed: Clock,
  sent: Send,
  drafts: Mail,
  spam: ShieldAlert,
  trash: Trash2,
  archive: Archive,
};

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
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [adv, setAdv] = React.useState({
    from: "",
    to: "",
    subject: "",
    since: "",
    before: "",
    hasAttachment: false,
    unread: false,
    starred: false,
  });
  const [sourceOpen, setSourceOpen] = React.useState(false);
  const [sourceText, setSourceText] = React.useState("");
  const [composeOpen, setComposeOpen] = React.useState(openCompose);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [pane, setPane] = React.useState<Pane>(initialUid != null ? "reader" : "list");
  const [compose, setCompose] = React.useState<ComposeState>(emptyCompose);
  const [moveTarget, setMoveTarget] = React.useState("");
  const [bulkMoveTarget, setBulkMoveTarget] = React.useState("");
  const [preview, setPreview] = React.useState<{ url: string; kind: "image" | "pdf" } | null>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [folderDialog, setFolderDialog] = React.useState<
    null | { mode: "create"; parent?: string } | { mode: "rename"; path: string; name: string }
  >(null);
  const [folderNameInput, setFolderNameInput] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"messages" | "threads">("messages");
  const [folderBusy, setFolderBusy] = React.useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const isStarredView = folder === STARRED_VIRTUAL;

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

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>("[data-orbit-global-search]");
        el?.focus();
        el?.select();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
    queryKey: ["webmail", "messages", folder, searchQ, page, viewMode, isStarredView],
    queryFn: async () => {
      if (isStarredView) {
        const data = await webmailApi<{ messages: MessageItem[] }>(
          `/api/webmail/search?folder=${encodeURIComponent("INBOX")}&q=${encodeURIComponent(searchQ || "is:starred")}&flagged=1`,
        );
        return { messages: data.messages, total: data.messages.length, page: 1, pageSize: data.messages.length };
      }
      if (searchQ.trim()) {
        const data = await webmailApi<{ messages: MessageItem[] }>(
          `/api/webmail/search?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(searchQ)}`,
        );
        return { messages: data.messages, total: data.messages.length, page: 1, pageSize: data.messages.length };
      }
      if (viewMode === "threads") {
        const data = await webmailApi<{ threads: ThreadItem[]; total: number; page: number; pageSize: number }>(
          `/api/webmail/messages/threads?folder=${encodeURIComponent(folder)}&page=${page}&pageSize=${PAGE_SIZE}`,
        );
        return {
          messages: data.threads.map((t) => ({
            uid: t.latestUid,
            subject: t.subject,
            from: t.participants[0] || "",
            fromEmail: t.participants[0] || "",
            date: t.lastDate,
            preview: t.preview,
            unseen: t.unseenCount > 0,
            flagged: t.flagged,
            hasAttachment: false,
            threadId: t.threadId,
          })),
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
        };
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

  const detailFolder = isStarredView ? "INBOX" : folder;

  const contactsQuery = useQuery({
    queryKey: ["webmail", "contacts"],
    queryFn: () => webmailApi<{ recent: string[] }>("/api/webmail/contacts"),
    staleTime: 120_000,
    enabled: !!meQuery.data,
  });

  const detailQuery = useQuery({
    queryKey: ["webmail", "message", detailFolder, selectedUid],
    queryFn: () =>
      webmailApi<MessageDetail>(
        `/api/webmail/messages/${selectedUid}?folder=${encodeURIComponent(detailFolder)}`,
      ),
    staleTime: 60_000,
    enabled: selectedUid != null,
    placeholderData: keepPreviousData,
  });

  const threadQuery = useQuery({
    queryKey: ["webmail", "thread", detailFolder, selectedUid],
    queryFn: () =>
      webmailApi<{ threadId: string; messages: MessageDetail[] }>(
        `/api/webmail/messages/${selectedUid}/thread?folder=${encodeURIComponent(detailFolder)}`,
      ),
    staleTime: 60_000,
    enabled: selectedUid != null && viewMode === "threads",
  });

  if (!layout) {
    return <div className="h-dvh bg-[#050508]" aria-hidden />;
  }

  const folders = foldersQuery.data ?? [];
  const customFolders = folders.filter((f) => !isReservedSystemPath(f.path));
  const messages = messagesQuery.data?.messages ?? [];
  const total = messagesQuery.data?.total ?? 0;
  const me = meQuery.data ?? null;
  const displayName = me?.branding?.displayName || me?.name || "";
  const detail = selectedUid != null ? (detailQuery.data ?? null) : null;
  const threadMessages =
    viewMode === "threads" && threadQuery.data?.messages && threadQuery.data.messages.length > 1
      ? threadQuery.data.messages
      : detail
        ? [detail]
        : [];
  const inboxUnseen = folders.find((f) => f.path.toUpperCase() === "INBOX")?.unseen ?? 0;
  const folderLabel = isStarredView
    ? "Starred"
    : folderIconLabel(folders.find((f) => f.path === folder) || { path: folder, name: folder, unseen: 0, messages: 0 }) ||
      folder;

  const systemNavResolved = SYSTEM_NAV.map((item) => {
    if (item.virtual === "starred") {
      return { item, path: STARRED_VIRTUAL, unseen: 0, messages: 0, matched: null as Folder | null };
    }
    const matched = matchSystemFolder(folders, item);
    const path = matched?.path || item.defaultPath;
    const live = folders.find((f) => f.path === path);
    return {
      item,
      path,
      unseen: live?.unseen ?? 0,
      messages: live?.messages ?? 0,
      matched: live || matched,
    };
  });

  function nestCustomFolders(list: Folder[]) {
    const delim = list.find((f) => f.delimiter)?.delimiter || "/";
    type Node = Folder & { children: Node[]; depth: number };
    const roots: Node[] = [];
    const byPath = new Map<string, Node>();
    const sorted = [...list].sort((a, b) => a.path.localeCompare(b.path));
    for (const f of sorted) {
      const node: Node = { ...f, children: [], depth: 0 };
      byPath.set(f.path, node);
      const parts = f.path.split(delim);
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join(delim);
        const parent = byPath.get(parentPath);
        if (parent) {
          node.depth = parent.depth + 1;
          parent.children.push(node);
          continue;
        }
      }
      roots.push(node);
    }
    const flat: Array<Folder & { depth: number }> = [];
    const walk = (nodes: Node[]) => {
      for (const n of nodes) {
        flat.push(n);
        walk(n.children);
      }
    };
    walk(roots);
    return flat;
  }

  const nestedCustom = nestCustomFolders(customFolders);

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

  function selectFolder(path: string, _key?: SystemNavKey | "custom" | "starred") {
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

  function selectSystemNav(key: SystemNavKey) {
    const item = SYSTEM_NAV.find((n) => n.key === key);
    if (!item) return;
    if (item.virtual === "starred") {
      selectFolder(STARRED_VIRTUAL, "starred");
      return;
    }
    const matched = matchSystemFolder(folders, item);
    selectFolder(matched?.path || item.defaultPath, key);
  }

  function applyAdvancedSearch() {
    const parts: string[] = [];
    if (adv.from.trim()) parts.push(`from:${adv.from.trim()}`);
    if (adv.to.trim()) parts.push(`to:${adv.to.trim()}`);
    if (adv.subject.trim()) parts.push(`subject:"${adv.subject.trim()}"`);
    if (adv.since.trim()) parts.push(`since:${adv.since.trim()}`);
    if (adv.before.trim()) parts.push(`before:${adv.before.trim()}`);
    if (adv.hasAttachment) parts.push("has:attachment");
    if (adv.unread) parts.push("is:unread");
    if (adv.starred) parts.push("is:starred");
    const q = parts.join(" ").trim();
    setQuery(q);
    setSearchQ(q);
    setPage(1);
    setAdvancedOpen(false);
  }

  async function downloadEml() {
    if (!selectedUid) return;
    const url = `/api/webmail/messages/${selectedUid}/raw?folder=${encodeURIComponent(detailFolder)}&format=eml`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function viewSource() {
    if (!selectedUid) return;
    try {
      const res = await fetch(
        `/api/webmail/messages/${selectedUid}/raw?folder=${encodeURIComponent(detailFolder)}&format=source`,
      );
      if (!res.ok) throw new Error("Failed to load source");
      const text = await res.text();
      setSourceText(text);
      setSourceOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "View source failed");
    }
  }

  function printMessage() {
    if (!detail) return;
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) return;
    const body = detail.html || `<pre style="white-space:pre-wrap;font-family:sans-serif">${detail.text}</pre>`;
    w.document.write(`<!doctype html><html><head><title>${detail.subject || "Message"}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111} a{color:#8a6d1a}</style>
      </head><body>
      <h1>${detail.subject || "(no subject)"}</h1>
      <p><strong>${detail.from}</strong> &lt;${detail.fromEmail}&gt;<br/>to ${detail.to}${detail.cc ? `<br/>cc ${detail.cc}` : ""}<br/>${detail.date || ""}</p>
      <hr/>${body}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  async function openMessage(uid: number) {
    setSelectedUid(uid);
    if (isStack) setPane("reader");
    router.push(webmailRoutes.message(uid), { scroll: false });
    qc.setQueryData<{ messages: MessageItem[]; total: number }>(
      ["webmail", "messages", folder, searchQ, page, viewMode, isStarredView],
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
        body: JSON.stringify({ action: "seen", folder: detailFolder, uids: [uid], seen: true }),
      });
      void qc.invalidateQueries({ queryKey: ["webmail", "folders"] });
    } catch {
      /* non-blocking */
    }
  }

  function prefetchMessage(uid: number) {
    void qc.prefetchQuery({
      queryKey: ["webmail", "message", detailFolder, uid],
      queryFn: () =>
        webmailApi<MessageDetail>(
          `/api/webmail/messages/${uid}?folder=${encodeURIComponent(detailFolder)}`,
        ),
      staleTime: 60_000,
    });
  }

  async function runAction(action: string, uids: number[], extra?: Record<string, unknown>) {
    if (uids.length === 0) return;
    try {
      await webmailApi("/api/webmail/messages/action", {
        method: "POST",
        body: JSON.stringify({ action, folder: detailFolder, uids, ...extra }),
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
    "orbit-mail-shell flex h-dvh flex-col overflow-hidden font-sans antialiased",
    light ? "bg-[#eef1f6] text-slate-900" : "bg-[#050508] text-[#f7f8fb]",
  );
  // Company logo only (never mailbox avatar) — one brand mark for all customers
  const companyLogo = me?.branding?.domainLogoDataUrl || "/brand/logo.png";
  const mailboxAvatar = me?.branding?.avatarUrl || null;
  const accent = me?.branding?.brandColor || "#d4af37";

  function CompanyLogo({ className }: { className?: string }) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={companyLogo}
        alt={me?.branding?.domainCompanyName || "GLOBAL ORBIT PVT LTD"}
        className={cn("orbit-brand-logo object-contain", className)}
      />
    );
  }

  function renderFolderButton(f: Folder & { depth?: number }, opts?: { custom?: boolean }) {
    const active = f.path === folder && !isStarredView;
    const label = opts?.custom ? f.name : folderIconLabel(f);
    const Icon = Mail;
    return (
      <div key={f.path} className="group relative mb-0.5" style={{ paddingLeft: (f.depth || 0) * 12 }}>
        <button
          type="button"
          onClick={() => selectFolder(f.path, "custom")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors duration-150",
            active
              ? "bg-[rgba(212,175,55,0.18)] font-semibold text-[#f0d78c] shadow-[inset_3px_0_0_#d4af37]"
              : light
                ? "text-slate-600 hover:bg-amber-50"
                : "text-zinc-400 hover:bg-[rgba(212,175,55,0.1)] hover:text-white",
          )}
        >
          <Icon className="size-4 shrink-0" style={opts?.custom ? { color: "#d4af37" } : undefined} />
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

  function renderSystemNavButton(entry: (typeof systemNavResolved)[number]) {
    const { item, path, unseen } = entry;
    const active = item.virtual === "starred" ? isStarredView : folder === path && !isStarredView;
    const Icon = NAV_ICONS[item.key];
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => selectSystemNav(item.key)}
        className={cn(
          "mb-0.5 flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors duration-150",
          active
            ? "bg-[rgba(212,175,55,0.18)] font-semibold text-[#f0d78c] shadow-[inset_3px_0_0_#d4af37]"
            : light
              ? "text-slate-600 hover:bg-amber-50"
              : "text-zinc-400 hover:bg-[rgba(212,175,55,0.1)] hover:text-white",
        )}
      >
        <Icon className="size-4 shrink-0" style={{ color: active ? item.color : undefined }} />
        <span className="flex-1 truncate">{item.label}</span>
        {unseen > 0 ? (
          <span className="min-w-[1.35rem] rounded-full bg-[#d4af37] px-1.5 text-center text-[0.7rem] font-bold text-[#1a1200]">
            {unseen}
          </span>
        ) : null}
      </button>
    );
  }

  const topBar = (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center gap-3 border-b px-3 sm:h-[4.5rem] sm:px-4",
        light ? "border-slate-200 bg-white/95" : "border-white/[0.07] bg-[#0b0b11]/95 backdrop-blur-xl",
      )}
    >
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
      ) : (
        <div className={cn("flex shrink-0 items-center", sidebarWidth)}>
          <CompanyLogo className="h-[3.75rem] max-h-[4.25rem] w-auto max-w-[calc(100%-0.5rem)] sm:h-[4.5rem] sm:max-h-[5.25rem] sm:max-w-[280px] xl:max-w-[300px]" />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearchQ(query.trim());
        }}
        className="relative mx-auto hidden min-w-0 max-w-xl flex-1 md:block"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          data-orbit-global-search
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mail…"
          className={cn(
            "h-10 w-full rounded-xl border pl-9 pr-16 text-sm outline-none focus:border-[#d4af37]/70",
            light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#12121a] text-white",
          )}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 text-[0.65rem] text-zinc-500">
          ⌘K
        </span>
      </form>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => setAdvancedOpen(true)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-[#f0d78c]"
          title="Advanced search"
        >
          <Filter className="size-4" />
        </button>
        {me?.online ? (
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-400 sm:inline-flex">
            <i className="size-1.5 rounded-full bg-emerald-400" />
            Online
          </span>
        ) : null}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className="relative rounded-lg p-2 text-zinc-400 hover:bg-white/5"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {inboxUnseen > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#d4af37] text-[0.6rem] font-bold text-[#1a1200]">
                {inboxUnseen > 9 ? "9+" : inboxUnseen}
              </span>
            ) : null}
          </button>
          {notifOpen ? (
            <div
              className={cn(
                "absolute right-0 top-10 z-30 w-72 rounded-xl border p-4 text-sm shadow-xl",
                light ? "border-slate-200 bg-white text-slate-700" : "border-white/10 bg-[#12121a] text-zinc-300",
              )}
            >
              <p className="font-semibold text-[#f0d78c]">Notifications</p>
              <p className="mt-2 text-zinc-500">
                {inboxUnseen > 0 ? `${inboxUnseen} unread in Inbox` : "No new notifications"}
              </p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => router.push(webmailRoutes.profile)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
          title="Profile & settings"
        >
          <HelpCircle className="size-4" />
        </button>
        <div className="ml-1 hidden min-w-0 items-center gap-2 border-l border-white/10 pl-3 sm:flex">
          <button
            type="button"
            onClick={() => router.push(webmailRoutes.profile)}
            className="min-w-0 text-right"
          >
            <p className="truncate text-sm font-semibold leading-tight">{displayName || "…"}</p>
            <p className="truncate text-[0.7rem] text-zinc-500">{me?.email}</p>
          </button>
          <button
            type="button"
            onClick={() => router.push(webmailRoutes.profile)}
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#d4af37]/50 to-[#1e5fa1]/50 text-xs font-bold"
          >
            {mailboxAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mailboxAvatar} alt="" className="size-full object-cover" />
            ) : (
              initials(displayName || me?.email || "?")
            )}
          </button>
        </div>
      </div>
    </header>
  );

  const sidebar = (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r",
        sidebarWidth,
        light ? "border-slate-200 bg-white/90 backdrop-blur-xl" : "border-white/[0.07] bg-[#0b0b11]/95 backdrop-blur-xl",
        isStack && "fixed inset-y-0 left-0 z-40 shadow-2xl",
      )}
    >
      {/* No second company logo in sidebar — brand lives only in top-left header */}
      <div className={cn("shrink-0", isStack ? "pt-3" : "pt-2")} />

      <button
        type="button"
        onClick={() => {
          setCompose(emptyCompose());
          setComposeOpen(true);
          setDrawerOpen(false);
        }}
        className="mx-3 mb-3 mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] px-4 py-3 text-sm font-bold text-[#1a1200] shadow-[0_8px_22px_rgba(212,175,55,0.28)] transition hover:brightness-105 active:scale-[0.99]"
      >
        <PenSquare className="size-4" />
        Compose
      </button>

      <nav className="orbit-scroll flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        <p className="mb-1 px-3 pt-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#d4af37]/85">
          Mailbox
        </p>
        {foldersQuery.isLoading && folders.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-1 h-10 animate-pulse rounded-[10px] bg-white/5" />
            ))
          : systemNavResolved.map((entry) => renderSystemNavButton(entry))}

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
        {nestedCustom.length === 0 ? (
          <p className="px-3 pt-2 text-xs text-zinc-600">No custom folders yet.</p>
        ) : (
          nestedCustom.map((f) => renderFolderButton(f, { custom: true }))
        )}
      </nav>

      <div
        className={cn(
          "mx-3 mb-3 rounded-xl border p-3",
          light ? "border-slate-200 bg-slate-50/90" : "border-white/8 bg-[#12121a]/90",
        )}
      >
        {quotaMb > 0 ? (
          <div>
            <div className="mb-1 flex items-center justify-between text-[0.7rem] text-zinc-500">
              <span>Storage</span>
              <span>
                {formatStorageMb(usedMb)} of {formatStorageMb(quotaMb)} used ({Math.round(usedPct)}%)
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
        ) : (
          <p className="text-xs text-zinc-500">Storage usage unavailable</p>
        )}
      </div>

      <div className="flex items-center justify-around border-t border-white/8 px-2 py-3">
        <button
          type="button"
          onClick={() => router.push(webmailRoutes.profile)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
          title="Profile & settings"
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
      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-3 md:hidden">
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
            placeholder="Search"
            className={cn(
              "h-9 w-full rounded-xl border pl-9 pr-3 text-sm outline-none focus:border-[#d4af37]/70",
              light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#0a0a12] text-white",
            )}
          />
        </form>
        <button
          type="button"
          onClick={() => setAdvancedOpen(true)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
          title="Advanced search"
        >
          <Filter className="size-4" />
        </button>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold tracking-tight">
          {folderLabel}{" "}
          <span className="text-[#f0d78c]">
            {folder.toUpperCase() === "INBOX" && !isStarredView ? inboxUnseen || total : total}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          {!searchQ.trim() && !isStarredView ? (
            <div className="mr-1 flex rounded-lg border border-white/10 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setViewMode("messages");
                  setPage(1);
                }}
                className={cn(
                  "rounded-md px-2 py-1",
                  viewMode === "messages" ? "bg-[#d4af37]/20 text-[#f0d78c]" : "text-zinc-400",
                )}
              >
                Messages
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("threads");
                  setPage(1);
                }}
                className={cn(
                  "rounded-md px-2 py-1",
                  viewMode === "threads" ? "bg-[#d4af37]/20 text-[#f0d78c]" : "text-zinc-400",
                )}
              >
                Threads
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void messagesQuery.refetch()}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/5"
            title="Refresh"
          >
            ↻
          </button>
          <button type="button" className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5" title="More">
            <MoreHorizontal className="size-4" />
          </button>
        </div>
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
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5"
              title="Mark read"
              onClick={() => void runAction("seen", selectedUids, { seen: true })}
            >
              Read
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5"
              title="Mark unread"
              onClick={() => void runAction("seen", selectedUids, { seen: false })}
            >
              Unread
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5"
              title="Star"
              onClick={() => void runAction("flag", selectedUids, { flagged: true })}
            >
              <Star className="size-3.5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5"
              title="Unstar"
              onClick={() => void runAction("flag", selectedUids, { flagged: false })}
            >
              <Star className="size-3.5 fill-none" />
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
                <div className="orbit-empty-state">
                  <div className="orbit-empty-state__icon">
                    <Mail className="size-7 text-[#d4af37]" />
                  </div>
                  <p className="orbit-empty-state__title">No messages here</p>
                  <p className="orbit-empty-state__hint">
                    Your {folderLabel.toLowerCase()} is empty. Compose a message or refresh to check for new mail.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCompose(emptyCompose());
                      setComposeOpen(true);
                    }}
                    className="mt-1 rounded-full bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] px-4 py-2 text-sm font-bold text-[#1a1200]"
                  >
                    Compose
                  </button>
                </div>
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
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"
                onClick={() => printMessage()}
                title="Print"
              >
                <Printer className="size-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"
                onClick={() => void downloadEml()}
                title="Download EML"
              >
                <FileDown className="size-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"
                onClick={() => void viewSource()}
                title="View source"
              >
                <Code2 className="size-3.5" />
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
      </div>

      {!selectedUid ? (
        <div className="orbit-empty-state flex-1">
          <div className="orbit-empty-state__icon">
            <Mail className="size-8 text-[#d4af37]" />
          </div>
          <p className="orbit-empty-state__title">Select a message to read</p>
          <p className="orbit-empty-state__hint">
            Choose a conversation from the list to view the full message, attachments, and reply options.
          </p>
        </div>
      ) : detailQuery.isLoading && !detail ? (
        <div className="flex-1 space-y-4 p-6">
          <div className="orbit-skeleton h-8 w-2/3 rounded-lg" />
          <div className="orbit-skeleton h-4 w-1/3 rounded-lg" />
          <div className="orbit-skeleton mt-8 h-40 rounded-xl" />
        </div>
      ) : detail ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-white/8 px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-bold leading-snug sm:text-xl">{detail.subject || "(no subject)"}</h1>
              <span className="shrink-0 rounded-full bg-[#d4af37]/20 px-2 py-0.5 text-xs font-semibold text-[#f0d78c]">
                {folderLabel}
                {threadMessages.length > 1 ? ` · ${threadMessages.length} messages` : ""}
              </span>
            </div>
          </div>

          <div className="orbit-scroll flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {threadMessages.map((msg, idx) => (
              <article
                key={`${msg.uid}-${idx}`}
                className={cn(
                  "mb-6 rounded-xl border p-4",
                  light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.02]",
                  msg.uid === selectedUid && "ring-1 ring-[#d4af37]/40",
                )}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37]/50 to-[#1e5fa1]/50 text-xs font-bold">
                      {initials(msg.from)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm">
                        {msg.from}{" "}
                        <span className="font-normal text-zinc-500">&lt;{msg.fromEmail}&gt;</span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        to {msg.to || "me"}
                        {msg.cc ? ` · cc ${msg.cc}` : ""} · {formatWhen(msg.date)}
                      </p>
                    </div>
                  </div>
                  {msg.uid === selectedUid ? (
                    <div className="flex items-center gap-1 text-zinc-400">
                      <button type="button" onClick={() => startReply("reply")} className="rounded-lg p-1.5 hover:bg-white/5" title="Reply">
                        <Reply className="size-4" />
                      </button>
                      <button type="button" onClick={() => startReply("replyAll")} className="rounded-lg p-1.5 hover:bg-white/5" title="Reply all">
                        <ReplyAll className="size-4" />
                      </button>
                      <button type="button" onClick={() => startReply("forward")} className="rounded-lg p-1.5 hover:bg-white/5" title="Forward">
                        <Forward className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {msg.html ? (
                  <div
                    className={cn(
                      "orbit-mail-body prose max-w-none text-[0.98rem] leading-relaxed prose-a:text-[#d4af37]",
                      light ? "prose-slate text-slate-900" : "prose-invert text-zinc-100",
                    )}
                    dangerouslySetInnerHTML={{ __html: msg.html }}
                  />
                ) : (
                  <pre
                    className={cn(
                      "whitespace-pre-wrap font-sans text-[0.98rem] leading-relaxed",
                      light ? "text-slate-800" : "text-zinc-100",
                    )}
                  >
                    {msg.text}
                  </pre>
                )}
                {msg.attachments.length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold">{msg.attachments.length} Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.attachments.map((a) => (
                        <a
                          key={a.part}
                          href={`/api/webmail/messages/${msg.uid}/attachments/${a.part}?folder=${encodeURIComponent(detailFolder)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
                        >
                          <Paperclip className="size-3" />
                          {a.filename}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
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
    <div
      className={shell}
      data-layout={layout}
      data-theme={light ? "light" : "dark"}
      style={{ ["--orbit-gold" as string]: accent }}
    >
      {topBar}
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
            <Image src={companyLogo} alt="GLOBAL ORBIT" width={160} height={48} className="h-11 w-auto max-w-[160px] object-contain" unoptimized={companyLogo.startsWith("data:")} />
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
            {systemNavResolved.map((entry) => renderSystemNavButton(entry))}
            <div className="mt-3 px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-zinc-500">Folders</div>
            {nestedCustom.map((f) => renderFolderButton(f, { custom: true }))}
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
      </div>

      <ComposeWindow
        open={composeOpen}
        initial={compose}
        recentRecipients={recentRecipients}
        mobile={layout === "mobile"}
        signatureHtml={me?.branding?.signatureHtml}
        signatureText={me?.branding?.signatureText}
        signatureLogo={me?.branding?.domainLogoDataUrl}
        displayName={displayName}
        companyName={me?.branding?.company || me?.branding?.domainCompanyName}
        phone={me?.branding?.phone}
        website={me?.branding?.website}
        senderEmail={me?.email}
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

      {advancedOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={cn(
              "w-full max-w-lg rounded-2xl border p-5 shadow-2xl",
              light ? "border-slate-200 bg-white" : "border-white/10 bg-[#12121a]",
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#f0d78c]">Advanced search</h3>
              <button type="button" onClick={() => setAdvancedOpen(false)} className="rounded-lg p-1 hover:bg-white/5">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["from", "From"],
                  ["to", "To"],
                  ["subject", "Subject"],
                  ["since", "Since (YYYY-MM-DD)"],
                  ["before", "Before (YYYY-MM-DD)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs text-zinc-400">
                  {label}
                  <input
                    value={adv[key]}
                    onChange={(e) => setAdv((a) => ({ ...a, [key]: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-transparent px-3 text-sm outline-none focus:border-[#d4af37]/60"
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adv.hasAttachment}
                  onChange={(e) => setAdv((a) => ({ ...a, hasAttachment: e.target.checked }))}
                  className="accent-[#d4af37]"
                />
                Has attachment
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adv.unread}
                  onChange={(e) => setAdv((a) => ({ ...a, unread: e.target.checked }))}
                  className="accent-[#d4af37]"
                />
                Unread
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adv.starred}
                  onChange={(e) => setAdv((a) => ({ ...a, starred: e.target.checked }))}
                  className="accent-[#d4af37]"
                />
                Starred
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5"
                onClick={() => {
                  setAdv({
                    from: "",
                    to: "",
                    subject: "",
                    since: "",
                    before: "",
                    hasAttachment: false,
                    unread: false,
                    starred: false,
                  });
                  setSearchQ("");
                  setQuery("");
                  setAdvancedOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applyAdvancedSearch}
                className="rounded-lg bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] px-4 py-2 text-sm font-bold text-[#1a1200]"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sourceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-[#0b0b11] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="font-semibold text-[#f0d78c]">Message source</h3>
              <button type="button" onClick={() => setSourceOpen(false)} className="rounded-lg p-1 hover:bg-white/5">
                <X className="size-4" />
              </button>
            </div>
            <pre className="orbit-scroll flex-1 overflow-auto whitespace-pre-wrap break-all p-4 text-xs text-zinc-300">
              {sourceText}
            </pre>
          </div>
        </div>
      ) : null}

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
