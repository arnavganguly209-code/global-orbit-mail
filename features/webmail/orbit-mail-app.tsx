"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
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
  loadRememberedRecipients,
  mergeRecipientLists,
} from "@/features/webmail/lib/recipient-memory";
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

const FOLDER_STORAGE_KEY = "orbit-webmail-folder";

export function OrbitMailApp({
  initialUid = null,
  initialFolder = null,
  openCompose = false,
}: {
  initialUid?: number | null;
  initialFolder?: string | null;
  openCompose?: boolean;
} = {}) {
  const router = useRouter();
  const qc = useQueryClient();
  const layout = useLayoutMode();
  /** Webmail dashboard is dark-only — no theme switching. */
  const light = false;

  const [folder, setFolder] = React.useState(initialFolder || "INBOX");
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
    if (initialFolder) {
      setFolder(initialFolder);
      try {
        sessionStorage.setItem(FOLDER_STORAGE_KEY, initialFolder);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const saved = sessionStorage.getItem(FOLDER_STORAGE_KEY);
      if (saved) setFolder(saved);
    } catch {
      /* ignore */
    }
  }, [initialFolder]);

  React.useEffect(() => {
    try {
      sessionStorage.setItem(FOLDER_STORAGE_KEY, folder);
    } catch {
      /* ignore */
    }
  }, [folder]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      const next = query.trim();
      setSearchQ((prev) => {
        if (prev === next) return prev;
        setPage(1);
        return next;
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [query]);

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
    // Do not keep previous message body — that made clicks feel broken.
  });

  const unreadNotifQuery = useQuery({
    queryKey: ["webmail", "notifications", "unread"],
    queryFn: async () => {
      const data = await webmailApi<{ messages: MessageItem[] }>(
        `/api/webmail/search?folder=${encodeURIComponent("INBOX")}&unseen=1&q=`,
      );
      return data.messages.slice(0, 10);
    },
    staleTime: 12_000,
    enabled: notifOpen && !!meQuery.data,
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
    return <div className="h-dvh bg-[#08090C]" aria-hidden />;
  }

  const folders = foldersQuery.data ?? [];
  const customFolders = folders.filter((f) => !isReservedSystemPath(f.path));
  const messages = messagesQuery.data?.messages ?? [];
  const total = messagesQuery.data?.total ?? 0;
  const me = meQuery.data ?? null;
  const displayName = me?.branding?.displayName || me?.name || "";
  const detail = selectedUid != null && detailQuery.data?.uid === selectedUid ? detailQuery.data : null;
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

  function selectSystemNav(key: SystemNavKey) {
    const item = SYSTEM_NAV.find((n) => n.key === key);
    if (!item) return;
    if (item.virtual === "starred") {
      selectFolder(STARRED_VIRTUAL);
      return;
    }
    const matched = matchSystemFolder(folders, item);
    selectFolder(matched?.path || item.defaultPath);
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

  async function openMessage(uid: number, opts?: { folderPath?: string }) {
    const targetFolder = opts?.folderPath || (isStarredView ? "INBOX" : folder);
    if (opts?.folderPath && opts.folderPath !== folder) {
      setFolder(opts.folderPath);
      setPage(1);
      setSearchQ("");
      setQuery("");
    }
    setSelectedUid(uid);
    if (isStack) setPane("reader");
    router.push(webmailRoutes.message(uid, targetFolder), { scroll: false });
    qc.setQueryData<{ messages: MessageItem[]; total: number }>(
      ["webmail", "messages", opts?.folderPath || folder, searchQ, page, viewMode, isStarredView],
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
        body: JSON.stringify({ action: "seen", folder: targetFolder, uids: [uid], seen: true }),
      });
      void qc.invalidateQueries({ queryKey: ["webmail", "folders"] });
      void qc.invalidateQueries({ queryKey: ["webmail", "notifications"] });
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
      ["webmail", "messages", folder, searchQ, page, viewMode, isStarredView],
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

  const recentRecipients = mergeRecipientLists(
    me?.email ? loadRememberedRecipients(me.email) : [],
    contactsQuery.data?.recent,
  );
  const sidebarWidth =
    layout === "desktop" ? "w-[300px]" : layout === "laptop" ? "w-[260px]" : "w-[min(340px,88vw)]";
  const listWidth =
    layout === "desktop" ? "w-[420px]" : layout === "laptop" ? "w-[340px]" : "w-full";

  const shell = cn(
    "orbit-mail-shell flex h-dvh flex-col overflow-hidden font-sans antialiased text-[#f7f8fb]",
  );
  // Left brand mark = Orbit product logo. Right profile / mail signature = customer upload.
  const companyLogo = "/brand/logo.png";
  const mailboxAvatar = me?.branding?.avatarUrl || me?.branding?.domainLogoDataUrl || null;
  const signatureLogo = me?.branding?.avatarUrl || me?.branding?.domainLogoDataUrl || null;
  const accent = me?.branding?.brandColor || "#d9b15c";

  function CompanyLogo({ className }: { className?: string }) {
    return (
      <span className="orbit-brand-logo-frame inline-flex max-w-full items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={companyLogo}
          alt="GLOBAL ORBIT PVT LTD"
          className={cn("orbit-brand-logo object-contain", className)}
        />
      </span>
    );
  }

  const navActive = "orbit-nav-active";
  const navIdle =
    "border border-transparent text-zinc-400 hover:bg-[rgba(23,61,52,0.35)] hover:text-white";
  const iconBtn =
    "rounded-xl p-2.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-[#ffd97a]";
  const accentText = "text-[#ffd97a]";
  const sectionLabel = "text-[#d9b15c]/90";

  function goToSentFolder() {
    const sentItem = SYSTEM_NAV.find((n) => n.key === "sent");
    if (!sentItem) {
      selectFolder("Sent");
      return;
    }
    const matched = matchSystemFolder(foldersQuery.data ?? [], sentItem);
    selectFolder(matched?.path || sentItem.defaultPath);
  }

  function renderFolderButton(f: Folder & { depth?: number }, opts?: { custom?: boolean }) {
    const active = f.path === folder && !isStarredView;
    const label = opts?.custom ? f.name : folderIconLabel(f);
    const Icon = Mail;
    return (
      <div key={f.path} className="group relative mb-0.5" style={{ paddingLeft: (f.depth || 0) * 12 }}>
        <button
          type="button"
          onClick={() => selectFolder(f.path)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors duration-150",
            active ? navActive : navIdle,
          )}
        >
          <Icon
            className="size-4 shrink-0"
            style={{ color: active ? "#d9b15c" : undefined }}
          />
          <span className="flex-1 truncate font-medium">{label}</span>
          {f.unseen > 0 ? (
            <span className="min-w-[1.35rem] rounded-full bg-[#d9b15c] px-1.5 text-center text-[0.7rem] font-bold text-[#1a1200]">
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
          active ? navActive : navIdle,
        )}
      >
        <Icon
          className="size-4 shrink-0"
          style={{
            color: active ? item.color : undefined,
          }}
        />
        <span className="flex-1 truncate font-medium">{item.label}</span>
        {unseen > 0 ? (
          <span className="min-w-[1.35rem] rounded-full bg-[#d9b15c] px-1.5 text-center text-[0.7rem] font-bold text-[#1a1200] shadow-[0_0_10px_rgba(217,177,92,0.35)]">
            {unseen}
          </span>
        ) : null}
      </button>
    );
  }

  const topBar = (
    <header className="orbit-glass-panel flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-white/[0.08] px-3 sm:h-[5.75rem] sm:px-5">
      {isStack ? (
        <button
          type="button"
          onClick={() => {
            if (layout === "mobile") setPane("folders");
            else setDrawerOpen(true);
          }}
          className={cn(iconBtn, "size-11 shrink-0")}
          aria-label="Open folders"
        >
          <Menu className="size-5" />
        </button>
      ) : (
        <div className={cn("flex shrink-0 items-center", sidebarWidth)}>
          <CompanyLogo className="h-[3.75rem] max-h-[5.25rem] w-auto max-w-[calc(100%-0.5rem)] sm:h-[5.25rem] sm:max-h-[6.25rem] sm:max-w-[calc(100%-0.25rem)]" />
        </div>
      )}

      {isStack ? (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={companyLogo}
            alt=""
            className="h-10 w-auto max-w-[150px] object-contain"
          />
          <p className="truncate text-[0.65rem] font-medium text-zinc-500">
            {me?.email || "Business email"}
          </p>
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearchQ(query.trim());
        }}
        className={cn(
          "relative min-w-0 max-w-2xl flex-1",
          isStack ? "hidden" : "mx-auto hidden md:block",
        )}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          data-orbit-global-search
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mail…"
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-[rgba(20,24,29,0.72)] pl-11 pr-16 text-sm font-medium text-white outline-none backdrop-blur-[40px] placeholder:text-zinc-500 focus:border-[#d9b15c]/55 focus:shadow-[0_0_0_3px_rgba(217,177,92,0.12)]"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-zinc-500">
          ⌘K
        </span>
      </form>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {isStack ? (
          <button
            type="button"
            onClick={() => {
              setCompose(emptyCompose());
              setComposeOpen(true);
            }}
            className="orbit-compose-btn mr-1 inline-flex size-10 items-center justify-center rounded-full text-[#1a1200]"
            aria-label="Compose"
          >
            <PenSquare className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setAdvancedOpen(true)}
          className={cn(iconBtn, "size-10")}
          title="Advanced search"
        >
          <Filter className="size-4" />
        </button>
        {me?.online ? (
          <span className="orbit-online-pill hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold sm:inline-flex">
            <i className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            Online
          </span>
        ) : null}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className={cn(iconBtn, "relative")}
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {inboxUnseen > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#d9b15c] text-[0.6rem] font-bold text-[#1a1200] shadow-[0_0_10px_rgba(217,177,92,0.55)]">
                {inboxUnseen > 9 ? "9+" : inboxUnseen}
              </span>
            ) : null}
          </button>
          <AnimatePresence>
            {notifOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="orbit-glass-panel absolute right-0 top-11 z-30 w-[22rem] overflow-hidden rounded-2xl border border-white/[0.08] text-sm shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                  <p className="font-semibold text-[#ffd97a]">Notifications</p>
                  <span className="text-xs font-medium text-zinc-500">
                    {inboxUnseen > 0 ? `${inboxUnseen} unread` : "All caught up"}
                  </span>
                </div>
                <div className="orbit-scroll max-h-80 overflow-y-auto">
                  {unreadNotifQuery.isLoading ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="orbit-skeleton h-14 rounded-xl" />
                      ))}
                    </div>
                  ) : (unreadNotifQuery.data?.length ?? 0) === 0 ? (
                    <p className="px-4 py-8 text-center text-zinc-500">No new notifications</p>
                  ) : (
                    unreadNotifQuery.data?.map((m) => (
                      <button
                        key={m.uid}
                        type="button"
                        className="flex w-full gap-3 border-b border-white/[0.05] px-4 py-3 text-left transition hover:bg-[rgba(23,61,52,0.35)]"
                        onClick={() => {
                          setNotifOpen(false);
                          void openMessage(m.uid, { folderPath: "INBOX" });
                        }}
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d9b15c]/45 to-[#173d34] text-[0.65rem] font-bold">
                          {initials(m.from || m.fromEmail)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{m.from || m.fromEmail}</span>
                            <span className="shrink-0 text-[0.65rem] text-zinc-500">{formatWhen(m.date)}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-zinc-300">
                            {m.subject || "(no subject)"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500">{m.preview}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => router.push(webmailRoutes.profile)}
          className={iconBtn}
          title="Profile & settings"
        >
          <HelpCircle className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => router.push(webmailRoutes.profile)}
          className="ml-1 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.1] bg-gradient-to-br from-[#d9b15c]/45 to-[#173d34] text-xs font-bold"
          title="Account · Change Password"
        >
          {mailboxAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mailboxAvatar} alt="" className="size-full object-cover" />
          ) : (
            initials(displayName || me?.email || "?")
          )}
        </button>
      </div>
    </header>
  );

  const sidebar = (
    <aside
      className={cn(
        "orbit-glass-panel flex shrink-0 flex-col border-r border-white/[0.08]",
        sidebarWidth,
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
        className="orbit-compose-btn mx-3 mb-3 mt-1 flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-[#1a1200] transition hover:brightness-105 active:scale-[0.99]"
      >
        <PenSquare className="size-4" />
        Compose
      </button>

      <nav className="orbit-scroll flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        <p className={cn("mb-1.5 px-3 pt-1 text-[0.68rem] font-bold uppercase tracking-[0.16em]", sectionLabel)}>
          Mailbox
        </p>
        {foldersQuery.isLoading && folders.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-1 h-10 animate-pulse rounded-[12px] bg-white/5" />
            ))
          : systemNavResolved.map((entry) => renderSystemNavButton(entry))}

        <div className="mt-4 flex items-center justify-between px-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-zinc-500">Folders</p>
          <button
            type="button"
            onClick={openCreateFolder}
            className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-[#ffd97a]"
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

      <div className="orbit-glass-panel mx-3 mb-3 rounded-2xl border border-white/[0.08] p-3.5">
        {quotaMb > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between text-[0.7rem] font-medium text-zinc-400">
              <span className="uppercase tracking-[0.12em] text-[#d9b15c]/90">Storage</span>
              <span>
                {formatStorageMb(usedMb)} of {formatStorageMb(quotaMb)} used ({Math.round(usedPct)}%)
              </span>
            </div>
            <div className="orbit-storage-bar">
              <span style={{ width: `${usedPct}%` }} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Storage usage unavailable</p>
        )}
      </div>

      <div className="flex items-center justify-around border-t border-white/[0.08] px-2 py-3">
        <button type="button" onClick={() => router.push(webmailRoutes.profile)} className={iconBtn} title="Profile & settings">
          <Settings className="size-4" />
        </button>
        <button type="button" onClick={() => router.push(webmailRoutes.contacts)} className={iconBtn} title="Contacts">
          <Users className="size-4" />
        </button>
        <button type="button" onClick={() => void logout()} className={iconBtn} title="Logout">
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );

  const listPane = (
    <section
      className={cn(
        "orbit-glass-panel flex min-h-0 shrink-0 flex-col border-r border-white/[0.08]",
        listWidth,
        isStack && "min-w-0 flex-1 border-r-0",
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
              "h-11 w-full rounded-xl border pl-9 pr-3 text-[16px] outline-none focus:border-[#d4af37]/70 sm:text-sm",
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

      <div className="flex items-center justify-between px-4 py-3.5">
        <h2 className="text-lg font-bold tracking-tight">
          {folderLabel}{" "}
          <span className={accentText}>
            {folder.toUpperCase() === "INBOX" && !isStarredView ? inboxUnseen || total : total}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          {!searchQ.trim() && !isStarredView ? (
            <div className="mr-1 flex rounded-xl border border-white/[0.08] bg-black/20 p-0.5 text-xs backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  setViewMode("messages");
                  setPage(1);
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 font-semibold transition",
                  viewMode === "messages"
                    ? "bg-[rgba(23,61,52,0.85)] text-[#ffd97a]"
                    : "text-zinc-400 hover:text-white",
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
                  "rounded-lg px-2.5 py-1.5 font-semibold transition",
                  viewMode === "threads"
                    ? "bg-[rgba(23,61,52,0.85)] text-[#ffd97a]"
                    : "text-zinc-400 hover:text-white",
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
              <div
                key={i}
                className={cn(
                  "mb-1.5 h-[72px] animate-pulse rounded-xl",
                  light ? "bg-slate-100" : "bg-white/[0.04]",
                )}
              />
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
                      role="button"
                      tabIndex={0}
                      data-active={active ? "true" : "false"}
                      data-unseen={m.unseen ? "true" : "false"}
                      onMouseEnter={() => prefetchMessage(m.uid)}
                      onFocus={() => prefetchMessage(m.uid)}
                      onClick={() => void openMessage(m.uid)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void openMessage(m.uid);
                        }
                      }}
                      className={cn(
                        "orbit-mail-row mb-1.5 flex w-full gap-2 rounded-2xl border px-2.5 py-3 text-left",
                        active
                          ? "border-[#d9b15c]/45 bg-[rgba(217,177,92,0.1)]"
                          : "border-transparent",
                        m.unseen && "font-semibold",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(m.uid)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 size-3.5 shrink-0 rounded border-white/20 accent-[#d9b15c]"
                        aria-label={`Select ${m.subject || "message"}`}
                      />
                      <span className="flex min-w-0 flex-1 gap-3 text-left">
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            m.unseen
                              ? "bg-gradient-to-br from-[#d9b15c]/55 to-[#173d34] text-[#ffd97a]"
                              : "bg-gradient-to-br from-white/10 to-[#173d34]/60 text-zinc-200",
                          )}
                        >
                          {initials(m.from || m.fromEmail)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold tracking-tight">
                              {m.from || m.fromEmail}
                            </span>
                            <span className="shrink-0 text-[0.7rem] font-medium text-zinc-500">
                              {formatWhen(m.date)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-sm font-medium text-zinc-100">
                            {m.subject || "(no subject)"}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-xs font-normal text-zinc-500">
                            {m.hasAttachment ? <Paperclip className="size-3 text-[#d9b15c]" /> : null}
                            {m.preview || " "}
                          </span>
                        </span>
                      </span>
                      <button
                        type="button"
                        className="mt-1 shrink-0 rounded p-1 hover:bg-white/5"
                        onClick={(e) => void toggleFlag(m, e)}
                        aria-label={m.flagged ? "Unstar" : "Star"}
                      >
                        <Star
                          className={cn(
                            "size-3.5",
                            m.flagged ? "fill-[#d9b15c] text-[#d9b15c]" : "text-zinc-600",
                          )}
                        />
                      </button>
                    </div>
                  );
                })
              )}
      </div>

      <div
        className={cn(
          "flex items-center justify-between border-t px-4 py-2 text-xs",
          light ? "border-slate-200 text-slate-600" : "border-white/8 text-zinc-500",
        )}
      >
        <span>
          {total === 0 ? "0" : `${rangeStart}–${rangeEnd}`} of {total}
        </span>
        {!searching ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn("rounded-md p-1 disabled:opacity-40", light ? "hover:bg-slate-100" : "hover:bg-white/5")}
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
              className={cn("rounded-md p-1 disabled:opacity-40", light ? "hover:bg-slate-100" : "hover:bg-white/5")}
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
    <section className="orbit-glass-panel flex min-w-0 flex-1 flex-col border-white/[0.08]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-0.5 text-sm text-zinc-400">
          {isStack ? (
            <button
              type="button"
              onClick={() => {
                setSelectedUid(null);
                setPane("list");
                router.push(webmailRoutes.mail, { scroll: false });
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
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28 }}
          className="orbit-empty-state flex-1"
        >
          <div className="orbit-empty-state__orb" aria-hidden>
            <Mail className="size-8 text-[#ffd97a]" />
          </div>
          <p className="orbit-empty-state__title">Select a message to read</p>
          <p className="orbit-empty-state__hint">
            Choose a conversation from the list to view the full message, attachments, and reply options.
          </p>
        </motion.div>
      ) : detailQuery.isFetching && !detail ? (
        <div className="flex-1 space-y-4 p-6">
          <div className="orbit-skeleton h-8 w-2/3 rounded-lg" />
          <div className="orbit-skeleton h-4 w-1/3 rounded-lg" />
          <div className="orbit-skeleton mt-8 h-40 rounded-xl" />
        </div>
      ) : detail ? (
        <motion.div
          key={detail.uid}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
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

          <div className="border-t border-white/[0.08] p-3 sm:p-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[rgba(20,24,29,0.72)] px-3 py-2.5 backdrop-blur-xl">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#d9b15c]/25 text-xs font-bold">
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
                className="orbit-compose-btn rounded-full px-4 py-2 text-sm font-bold text-[#1a1200]"
              >
                Reply
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-zinc-500">
          <p>Unable to load message</p>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-[#ffd97a] hover:bg-white/5"
            onClick={() => void detailQuery.refetch()}
          >
            Retry
          </button>
        </div>
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
            <div className="flex min-w-0 items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={companyLogo}
                alt="GLOBAL ORBIT"
                className="h-12 w-auto max-w-[200px] object-contain"
              />
            </div>
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
        signatureLogo={signatureLogo}
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
          ]).then(() => {
            goToSentFolder();
          });
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
