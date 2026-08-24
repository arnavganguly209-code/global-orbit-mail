"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
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
  KeyRound,
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
  User,
  Users,
  X,
  FolderPlus,
  CircleAlert,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MailHtmlFrame } from "@/features/webmail/mail-html-frame";
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
  WebmailApiError,
  type Folder,
  type Me,
  type MessageDetail,
  type MessageItem,
  type ThreadItem,
} from "@/features/webmail/lib/api";

type Pane = "folders" | "list" | "reader";

const PAGE_SIZE = 50;
const STARRED_VIRTUAL = "__starred__";

const NAV_ICONS: Record<
  SystemNavKey,
  React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>
> = {
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
  /** Gmail-style light workspace. Sidebar stays dark. */
  const light = true;

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
  const readerRef = React.useRef<HTMLElement>(null);
  const refreshLock = React.useRef(false);
  const lastMailboxSyncAt = React.useRef(0);
  const mailboxSyncInFlight = React.useRef<Promise<void> | null>(null);
  const [readerFs, setReaderFs] = React.useState(false);
  const [mailboxRefreshing, setMailboxRefreshing] = React.useState(false);
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setNotifOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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

  React.useEffect(() => {
    function onFs() {
      if (!document.fullscreenElement) setReaderFs(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setReaderFs(false);
    }
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  async function toggleReaderFs() {
    if (readerFs) {
      setReaderFs(false);
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
      }
      return;
    }
    setReaderFs(true);
    try {
      await readerRef.current?.requestFullscreen();
    } catch {
      /* CSS overlay fallback */
    }
  }

  const meQuery = useQuery({
    queryKey: ["webmail", "me"],
    queryFn: () => webmailApi<Me>("/api/webmail/auth/me"),
    staleTime: 60_000,
    retry: (count, err) => {
      if (err instanceof WebmailApiError && err.status === 401) return false;
      return count < 2;
    },
  });

  React.useEffect(() => {
    const err = meQuery.error;
    if (!(err instanceof WebmailApiError) || err.status !== 401) return;
    toast.error("Session expired");
    router.replace(webmailRoutes.home);
  }, [meQuery.error, router]);

  const foldersQuery = useQuery({
    queryKey: ["webmail", "folders"],
    queryFn: async () => {
      const data = await webmailApi<{ folders: Folder[] }>("/api/webmail/folders");
      return data.folders;
    },
    staleTime: 8_000,
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "hidden" ? false : 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
    staleTime: 4_000,
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "hidden" ? false : 10_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
    staleTime: 20_000,
    enabled: !!meQuery.data && notifOpen,
    refetchOnWindowFocus: false,
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

  const syncMailbox = React.useCallback(
    async (opts?: { spinner?: boolean; force?: boolean }) => {
      if (mailboxSyncInFlight.current) return mailboxSyncInFlight.current;
      if (!opts?.force && Date.now() - lastMailboxSyncAt.current < 1500) {
        return;
      }
      if (opts?.spinner) {
        if (refreshLock.current) return;
        refreshLock.current = true;
        setMailboxRefreshing(true);
      }
      const job = (async () => {
        lastMailboxSyncAt.current = Date.now();
        try {
          const [mailRes, folderRes] = await Promise.all([
            qc.refetchQueries({ queryKey: ["webmail", "messages"], type: "active" }),
            qc.refetchQueries({ queryKey: ["webmail", "folders"], type: "active" }),
          ]);
          if (notifOpen) {
            await qc.refetchQueries({ queryKey: ["webmail", "notifications"], type: "active" });
          }
          const failed =
            mailRes.some((r) => r.isError) || folderRes.some((r) => r.isError);
          if (opts?.spinner && failed) {
            toast.error("Unable to refresh mailbox. Please try again.");
          }
        } catch {
          if (opts?.spinner) toast.error("Unable to refresh mailbox. Please try again.");
        } finally {
          if (opts?.spinner) {
            refreshLock.current = false;
            setMailboxRefreshing(false);
          }
          mailboxSyncInFlight.current = null;
        }
      })();
      mailboxSyncInFlight.current = job;
      return job;
    },
    [qc, notifOpen],
  );

  async function refreshMailbox() {
    await syncMailbox({ spinner: true, force: true });
  }

  React.useEffect(() => {
    lastMailboxSyncAt.current = Date.now();
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void syncMailbox({ force: false });
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void syncMailbox({ force: true });
      else onVisible();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [syncMailbox]);

  if (!layout) {
    return <div className="h-dvh bg-[#eef1f6]" aria-hidden />;
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
  const folderUnseen = isStarredView
    ? 0
    : (folders.find((f) => f.path === folder)?.unseen ?? 0);
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

  const isMobile = layout === "mobile";
  const isTablet = layout === "tablet";
  const isWide = layout === "desktop" || layout === "laptop";
  const isStack = isMobile;
  const showSidebar = !readerFs && (isWide || ((isMobile || isTablet) && drawerOpen));
  const showList =
    !readerFs && (isWide || isTablet || (isMobile && pane !== "reader"));
  const showReader = readerFs || isWide || isTablet || (isMobile && pane === "reader");

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
    void qc.refetchQueries({ queryKey: ["webmail", "folders"], type: "active" });
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
    setNotifOpen(false);
    setDrawerOpen(false);
    setAdvancedOpen(false);
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
      void qc.refetchQueries({ queryKey: ["webmail", "folders"], type: "active" });
      void qc.refetchQueries({ queryKey: ["webmail", "notifications"] });
    } catch {
      /* non-blocking */
    }
  }

  function prefetchMessage(uid: number) {
    const key = ["webmail", "message", detailFolder, uid] as const;
    if (qc.getQueryData(key)) return;
    void qc.prefetchQuery({
      queryKey: key,
      queryFn: () =>
        webmailApi<MessageDetail>(
          `/api/webmail/messages/${uid}?folder=${encodeURIComponent(detailFolder)}`,
        ),
      staleTime: 60_000,
    });
  }

  async function runAction(action: string, uids: number[], extra?: Record<string, unknown>) {
    if (uids.length === 0) return;
    if (action === "seen") {
      const nextUnseen = extra?.seen === false;
      qc.setQueryData<{ messages: MessageItem[]; total: number }>(
        ["webmail", "messages", folder, searchQ, page, viewMode, isStarredView],
        (prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((m) =>
                  uids.includes(m.uid) ? { ...m, unseen: nextUnseen } : m,
                ),
              }
            : prev,
      );
    }
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
  const listWidth = isMobile
    ? "w-full"
    : layout === "desktop"
      ? "w-[420px]"
      : "w-[min(360px,38vw)]";

  const shell = cn(
    "orbit-mail-shell orbit-mail-app flex h-dvh min-w-0 flex-col overflow-hidden bg-white font-sans text-[#202124] antialiased",
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
    "border border-transparent text-[#f3efe6] hover:bg-white/[0.05] hover:text-white";
  const iconBtn =
    "rounded-lg p-2 text-[#d4af37] transition hover:bg-white/[0.06] hover:text-[#f0d78c]";
  const headerIcon =
    "rounded-xl p-2.5 text-[#5f6368] transition hover:bg-[#f1f3f4] hover:text-[#202124]";
  const accentText = "text-[#5f6368]";
  const sectionLabel = "text-[#d4af37]";

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
            "mb-0 grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-full px-2.5 py-[5px] text-left text-[13px] leading-tight transition-[background-color,box-shadow,border-color] duration-150",
            active ? navActive : navIdle,
          )}
        >
          <Icon
            className="size-4 w-4 shrink-0"
            strokeWidth={1.6}
            style={{ color: active ? "#f0d78c" : "#d4af37" }}
          />
          <span className="flex-1 truncate font-medium tracking-tight">{label}</span>
          {f.unseen > 0 ? (
            <span className="min-w-[1.15rem] rounded-full bg-[#d4af37] px-1.5 text-center text-[0.65rem] font-bold text-[#1a1200]">
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
          "mb-0 grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-full px-2.5 py-[5px] text-[13px] leading-tight transition-[background-color,box-shadow,border-color] duration-150",
          active ? navActive : navIdle,
        )}
      >
        <Icon
          className="size-4 w-4 shrink-0"
          strokeWidth={1.6}
          style={{ color: active ? "#f0d78c" : "#d4af37" }}
        />
        <span className="flex-1 truncate font-medium tracking-tight">{item.label}</span>
        {unseen > 0 ? (
          <span className="min-w-[1.15rem] rounded-full bg-[#d4af37] px-1.5 text-center text-[0.65rem] font-bold text-[#1a1200]">
            {unseen}
          </span>
        ) : null}
      </button>
    );
  }

  const topBar = (
    <header className="relative z-20 flex h-14 min-w-0 shrink-0 items-center gap-1 overflow-x-hidden border-b border-[#dadce0] bg-white px-2 sm:h-16 sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={cn(headerIcon, "size-10 shrink-0", isWide && "invisible")}
        aria-label="Open folders"
      >
        <Menu className="size-5" />
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearchQ(query.trim());
        }}
        className={cn(
          "relative min-w-0 max-w-3xl flex-1",
          isStack ? "mx-1" : "mx-auto w-full",
        )}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          data-orbit-global-search
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mail…"
          className="h-11 w-full rounded-full border-0 bg-[#f1f3f4] pl-11 pr-16 text-sm font-medium text-[#202124] outline-none placeholder:text-zinc-500 focus:bg-white focus:shadow-[0_1px_6px_rgba(32,33,36,0.16)]"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[#dadce0] px-1.5 py-0.5 text-[0.65rem] font-semibold text-zinc-500 sm:inline">
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
            className="orbit-compose-btn mr-1 inline-flex size-10 items-center justify-center rounded-full text-white"
            aria-label="Compose"
          >
            <PenSquare className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setAdvancedOpen(true)}
          className={cn(headerIcon, "size-10")}
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
        <div className="relative shrink-0" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className={cn(headerIcon, "relative")}
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <Bell className="size-4" />
            {inboxUnseen > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#d93025] text-[0.6rem] font-bold text-white">
                {inboxUnseen > 9 ? "9+" : inboxUnseen}
              </span>
            ) : null}
          </button>
          {notifOpen && typeof document !== "undefined"
            ? createPortal(
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[60] cursor-default bg-transparent"
                    aria-label="Close notifications"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div
                    role="dialog"
                    aria-label="Notifications"
                    className="fixed right-3 top-[4.25rem] z-[70] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white text-sm text-[#202124] shadow-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-3">
                      <p className="font-semibold text-[#202124]">Notifications</p>
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
                            className="flex w-full gap-3 border-b border-[#f1f3f4] px-4 py-3 text-left text-[#202124] transition hover:bg-[#f6f8fc]"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNotifOpen(false);
                              void openMessage(m.uid, { folderPath: "INBOX" });
                            }}
                          >
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[0.65rem] font-bold text-[#1a73e8]">
                              {initials(m.from || m.fromEmail)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold">{m.from || m.fromEmail}</span>
                                <span className="shrink-0 text-[0.65rem] text-zinc-500">{formatWhen(m.date)}</span>
                              </span>
                              <span className="mt-0.5 block truncate text-sm text-[#3c4043]">
                                {m.subject || "(no subject)"}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-zinc-500">{m.preview}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>,
                document.body,
              )
            : null}
        </div>
        <button
          type="button"
          onClick={() => router.push(webmailRoutes.profile)}
          className={headerIcon}
          title="Profile & settings"
        >
          <HelpCircle className="size-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dadce0] bg-[#e8eaed] text-xs font-bold text-[#202124]"
              title="Account"
            >
              {mailboxAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mailboxAvatar} alt="" className="size-full object-cover" />
              ) : (
                initials(displayName || me?.email || "?")
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-[#e5e7eb] bg-white text-[#202124]">
            <DropdownMenuItem onClick={() => router.push(webmailRoutes.profile)}>
              <User className="mr-2 size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(webmailRoutes.profile)}>
              <KeyRound className="mr-2 size-4" />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(webmailRoutes.contacts)}>
              <Users className="mr-2 size-4" />
              Contacts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void logout()}>
              <LogOut className="mr-2 size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );

  const sidebar = (
    <aside
      className={cn(
        "orbit-mail-sidebar flex shrink-0 flex-col text-[#f4f1ea]",
        isWide ? "w-[252px] min-w-[252px] max-w-[252px]" : "fixed inset-y-0 left-0 z-40 w-[min(280px,90vw)] shadow-2xl",
      )}
    >
      <div className="orbit-sidebar-logo-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={companyLogo}
          alt="GLOBAL ORBIT PVT LTD"
          className="orbit-sidebar-logo"
          decoding="async"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          setCompose(emptyCompose());
          setComposeOpen(true);
          setDrawerOpen(false);
        }}
        className="orbit-sidebar-compose mx-3 mb-3 mt-1 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold"
        aria-label="New Mail"
      >
        <PenSquare className="size-4" strokeWidth={2} />
        New Mail
      </button>

      <div className="shrink-0 px-2 pb-1">
        <p className={cn("mb-1 px-3 text-[0.62rem] font-semibold uppercase tracking-[0.18em]", sectionLabel)}>
          Mailbox
        </p>
        {foldersQuery.isLoading && folders.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-0.5 h-7 animate-pulse rounded-full bg-white/5" />
            ))
          : systemNavResolved.map((entry) => renderSystemNavButton(entry))}
      </div>

      <nav className="orbit-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        <div className="mt-1 flex items-center justify-between px-3">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#d4af37]">Folders</p>
          <button
            type="button"
            onClick={openCreateFolder}
            className="rounded-md p-1 text-[#d4af37] hover:bg-white/5 hover:text-[#f0d78c]"
            title="Create folder"
            aria-label="Create folder"
          >
            <FolderPlus className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
        {nestedCustom.length === 0 ? (
          <p className="px-3 pt-2 text-xs text-[#8a8378]">No custom folders yet.</p>
        ) : (
          nestedCustom.map((f) => renderFolderButton(f, { custom: true }))
        )}
      </nav>

      <div className="orbit-sidebar-storage mx-3 mb-2 rounded-2xl p-3">
        {quotaMb > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d4af37]">Storage</p>
            <p className="mt-1.5 text-xs font-semibold leading-snug text-white">
              {formatStorageMb(usedMb)} of {formatStorageMb(quotaMb)} used
            </p>
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="orbit-storage-bar min-w-0 flex-1" aria-hidden>
                <span style={{ width: `${usedPct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-white/90">
                {Math.round(usedPct)}%
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[#cfc6b8]">
              {formatStorageMb(Math.max(0, quotaMb - usedMb))} remaining
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#8a8378]">Storage usage unavailable</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-[rgba(255,215,130,0.12)] px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,215,130,0.2)] bg-white/5 text-[0.65rem] font-bold text-[#f0d78c]">
          {mailboxAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mailboxAvatar} alt="" className="size-full object-cover" />
          ) : (
            initials(displayName || me?.email || "?")
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-white" title={me?.email}>
          {me?.email || displayName}
        </span>
        <button type="button" onClick={() => router.push(webmailRoutes.profile)} className={iconBtn} title="Profile & settings" aria-label="Profile and settings">
          <Settings className="size-4" strokeWidth={1.6} />
        </button>
        <button type="button" onClick={() => void logout()} className={iconBtn} title="Logout" aria-label="Logout">
          <LogOut className="size-4" strokeWidth={1.6} />
        </button>
      </div>
    </aside>
  );

  const listPane = (
    <section
      className={cn(
        "orbit-mail-workspace flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-r border-[#e4e7ec] bg-white",
        listWidth,
        isStack && "min-w-0 flex-1 border-r-0",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2">
        <h2 className="shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight text-[#202124]">
          {folderLabel}
        </h2>
        {folderUnseen > 0 ? (
          <span
            className="inline-flex min-w-[1.35rem] shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] px-1.5 py-0.5 text-[11px] font-bold text-[#1a73e8]"
            title={`${folderUnseen} unread`}
          >
            {folderUnseen}
          </span>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!searchQ.trim() && !isStarredView ? (
            <div className="flex rounded-lg border border-[#e4e7ec] bg-[#f8f9fa] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setViewMode("messages");
                  setPage(1);
                }}
                className={cn(
                  "rounded-md px-2 py-1 font-semibold transition",
                  viewMode === "messages"
                    ? "bg-white text-[#202124] shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800",
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
                  "rounded-md px-2 py-1 font-semibold transition",
                  viewMode === "threads"
                    ? "bg-white text-[#202124] shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800",
                )}
              >
                Threads
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void refreshMailbox()}
            disabled={mailboxRefreshing}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#dadce0] bg-white px-2 text-[11px] font-semibold text-[#3c4043] hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-60"
            title="Refresh mailbox"
            aria-label="Refresh mailbox"
          >
            <RefreshCw className={cn("size-3.5 shrink-0", mailboxRefreshing && "animate-spin")} />
            <span>{mailboxRefreshing ? "Refreshing" : "Refresh"}</span>
          </button>
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
            title="More"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-[#e8eaed] px-3 py-2">
        <label className="flex items-center gap-2 text-xs text-[#5f6368]">
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={toggleSelectAllPage}
            className="size-3.5 accent-[#1a73e8]"
            aria-label="Select all on page"
          />
          Select all
        </label>
        {selectedUids.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-zinc-500">{selectedUids.length} selected</span>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
              title="Archive"
              onClick={() => void runAction("archive", selectedUids)}
            >
              <Archive className="size-3.5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
              title="Delete"
              onClick={() => void runAction("delete", selectedUids)}
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
              title="Spam"
              onClick={() => void runAction("spam", selectedUids)}
            >
              <ShieldAlert className="size-3.5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
              title="Mark read"
              onClick={() => void runAction("seen", selectedUids, { seen: true })}
            >
              Read
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
              title="Mark unread"
              onClick={() => void runAction("seen", selectedUids, { seen: false })}
            >
              Unread
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
              title="Star"
              onClick={() => void runAction("flag", selectedUids, { flagged: true })}
            >
              <Star className="size-3.5" />
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
              title="Unstar"
              onClick={() => void runAction("flag", selectedUids, { flagged: false })}
            >
              <Star className="size-3.5 fill-none" />
            </button>
            <select
              value={bulkMoveTarget}
              onChange={(e) => setBulkMoveTarget(e.target.value)}
              className="h-7 max-w-[110px] rounded-lg border border-[#dadce0] bg-white px-1 text-[0.7rem] text-[#202124]"
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
              className="rounded-lg px-2 py-1 text-[0.7rem] text-[#202124] hover:bg-[#f1f3f4] disabled:opacity-40"
              onClick={() => void runAction("move", selectedUids, { target: bulkMoveTarget })}
            >
              Go
            </button>
          </div>
        ) : null}
      </div>

      <div className="orbit-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [content-visibility:auto]">
        {messagesQuery.isError ? (
          <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            <span>Unable to refresh mailbox. Please try again.</span>
            <button type="button" className="font-semibold underline" onClick={() => void refreshMailbox()}>
              Retry
            </button>
          </div>
        ) : null}
        {messagesQuery.isLoading && messages.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "mb-0 h-[68px] animate-pulse rounded-none border-b border-[#eceef2] bg-[#f1f3f4]",
                )}
              />
            ))
          : messages.length === 0 && !messagesQuery.isError
            ? (
                <div className="orbit-empty-state">
                  <div className="orbit-empty-state__icon">
                    <Mail className="size-7 text-[#1a73e8]" />
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
                    className="mt-1 rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-bold text-white hover:bg-[#1557c0]"
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
                        "orbit-mail-row mb-0 flex w-full min-w-0 items-center gap-2 rounded-none border-0 border-b border-[#eceef2] px-2 py-3 text-left sm:gap-3 sm:px-3 sm:py-2.5",
                        active
                          ? "bg-[#e8f0fe]"
                          : m.unseen
                            ? "bg-[#e8f0fe]/55 hover:bg-[#e8f0fe]"
                            : "bg-white hover:bg-[#f6f8fc]",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(m.uid)}
                        onClick={(e) => e.stopPropagation()}
                        className="size-3.5 shrink-0 rounded accent-[#1a73e8]"
                        aria-label={`Select ${m.subject || "message"}`}
                      />
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          m.unseen ? "bg-[#1a73e8] text-white ring-2 ring-[#1a73e8]/25" : "bg-[#e8eaed] text-[#80868b]",
                        )}
                      >
                        {initials(m.from || m.fromEmail)}
                      </span>
                      <span className="flex min-w-0 flex-1 items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                m.unseen ? "size-2 bg-[#1a73e8]" : "size-1.5 bg-transparent",
                              )}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                "min-w-0 truncate text-[13px] leading-5",
                                m.unseen ? "font-extrabold text-black" : "font-normal text-[#5f6368]",
                              )}
                              title={m.from || m.fromEmail}
                            >
                              {m.from || m.fromEmail}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block truncate pl-3.5 text-[13px] leading-5",
                              m.unseen ? "font-extrabold text-black" : "font-normal text-[#5f6368]",
                            )}
                            title={m.subject || "(no subject)"}
                          >
                            {m.subject || "(no subject)"}
                            {m.preview ? (
                              <span className="font-normal text-[#80868b]">
                                {" — "}
                                {m.preview}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                          <span
                            className={cn(
                              "whitespace-nowrap text-[11px] tabular-nums",
                              m.unseen ? "font-extrabold text-[#1a73e8]" : "font-normal text-[#80868b]",
                            )}
                          >
                            {formatWhen(m.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            {m.hasAttachment ? <Paperclip className="size-3.5 text-[#80868b]" /> : null}
                            <button
                              type="button"
                              className="rounded p-0.5 hover:bg-black/5"
                              onClick={(e) => void toggleFlag(m, e)}
                              aria-label={m.flagged ? "Unstar" : "Star"}
                            >
                              <Star
                                className={cn(
                                  "size-3.5",
                                  m.flagged ? "fill-[#fbbc04] text-[#fbbc04]" : "text-[#dadce0]",
                                )}
                              />
                            </button>
                          </span>
                        </span>
                      </span>
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
    <section
      ref={readerRef}
      className={cn(
        "orbit-reader orbit-mail-workspace relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white",
        readerFs && "orbit-reader--fs",
      )}
    >
      <div className="orbit-reader-toolbar flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[#e8eaed] bg-white px-2 py-1.5 sm:px-3">
        {isMobile && !readerFs ? (
          <button
            type="button"
            onClick={() => {
              setSelectedUid(null);
              setPane("list");
              router.push(webmailRoutes.mail, { scroll: false });
            }}
            className="orbit-tool-btn mr-1 inline-flex items-center gap-1 px-2"
            title="Back to inbox"
            aria-label="Back to inbox"
          >
            <ArrowLeft className="size-4" />
            <span className="text-sm font-medium">Inbox</span>
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
            className="orbit-tool-btn"
            title={a.label}
            aria-label={a.label}
          >
            <a.icon className="size-4" />
          </button>
        ))}
        {selectedUid ? (
          <>
            <button
              type="button"
              className="orbit-tool-btn"
              onClick={() => void runAction("seen", [selectedUid], { seen: false })}
              title="Mark unread"
              aria-label="Mark unread"
            >
              <Mail className="size-4" />
            </button>
            <button
              type="button"
              className="orbit-tool-btn"
              onClick={() => {
                const flagged = messages.find((m) => m.uid === selectedUid)?.flagged;
                void runAction("flag", [selectedUid], { flagged: !flagged });
              }}
              title="Star"
              aria-label="Star"
            >
              <Star className="size-4" />
            </button>
            <button
              type="button"
              className="orbit-tool-btn"
              onClick={() => printMessage()}
              title="Print"
              aria-label="Print"
            >
              <Printer className="size-4" />
            </button>
            <button
              type="button"
              className="orbit-tool-btn"
              onClick={() => void downloadEml()}
              title="Download"
              aria-label="Download"
            >
              <FileDown className="size-4" />
            </button>
            <button
              type="button"
              className="orbit-tool-btn"
              onClick={() => void toggleReaderFs()}
              title={readerFs ? "Exit full screen" : "Enter full screen"}
              aria-label={readerFs ? "Exit full screen" : "Enter full screen"}
            >
              {readerFs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="orbit-tool-btn" title="More actions" aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-[#e4e7ec] bg-white text-[#202124]">
                <DropdownMenuItem onClick={() => void viewSource()}>View source</DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!moveTarget}
                  onClick={() => void runAction("move", [selectedUid], { target: moveTarget })}
                >
                  Move to selected folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!moveTarget}
                  onClick={() => void runAction("copy", [selectedUid], { target: moveTarget })}
                >
                  Copy to selected folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <select
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
              className="ml-1 hidden h-8 max-w-[9rem] shrink-0 rounded-lg border border-[#dadce0] bg-white px-2 text-xs text-[#202124] sm:block"
              aria-label="Move to folder"
              title="Move to folder"
            >
              <option value="">Move to…</option>
              {folders.map((f) => (
                <option key={f.path} value={f.path}>
                  {folderIconLabel(f)}
                </option>
              ))}
            </select>
            {readerFs ? (
              <button
                type="button"
            className="orbit-tool-btn ml-auto shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1a73e8] hover:bg-[#e8f0fe]"
                onClick={() => void toggleReaderFs()}
                title="Exit full screen"
                aria-label="Exit full screen"
              >
                Exit full screen
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {!selectedUid ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28 }}
          className="orbit-empty-state flex-1"
        >
          <div className="orbit-empty-state__orb" aria-hidden>
            <Mail className="size-10 text-[#1a73e8]" strokeWidth={1.5} />
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
          <div className="shrink-0 border-b border-[#e8eaed] bg-white px-4 py-3 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <h1
                className="min-w-0 flex-1 truncate text-lg font-bold leading-snug sm:text-xl"
                title={detail.subject || "(no subject)"}
              >
                {detail.subject || "(no subject)"}
              </h1>
              <span className="shrink-0 rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#1a73e8]">
                {folderLabel}
                {threadMessages.length > 1 ? ` · ${threadMessages.length} messages` : ""}
              </span>
            </div>
          </div>

          <div className="orbit-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 sm:px-8">
            <div className="mx-auto w-full min-w-0 max-w-[720px]">
            {threadMessages.map((msg, idx) => (
              <article
                key={`${msg.uid}-${idx}`}
                className={cn(
                  "mb-6 rounded-xl border border-[#e8eaed] bg-white p-4 text-[#202124]",
                  msg.uid === selectedUid && "ring-1 ring-[#1a73e8]/25",
                )}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-xs font-bold text-[#1a73e8]">
                      {initials(msg.from)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" title={`${msg.from} <${msg.fromEmail}>`}>
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
                      <button type="button" onClick={() => startReply("reply")} className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100" title="Reply">
                        <Reply className="size-4" />
                      </button>
                      <button type="button" onClick={() => startReply("replyAll")} className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100" title="Reply all">
                        <ReplyAll className="size-4" />
                      </button>
                      <button type="button" onClick={() => startReply("forward")} className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100" title="Forward">
                        <Forward className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {msg.html ? (
                  <div className="orbit-mail-body mx-auto w-full min-w-0 max-w-[720px] overflow-x-auto rounded-xl bg-white p-1">
                    <MailHtmlFrame html={msg.html} />
                  </div>
                ) : (
                  <pre className="mx-auto max-w-[720px] whitespace-pre-wrap break-words rounded-xl bg-white p-4 font-sans text-[0.98rem] leading-relaxed text-[#202124]">
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
                          className="inline-flex items-center gap-1 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-2 py-1 text-xs text-[#202124] hover:bg-[#eef1f6]"
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
          </div>

          <div className="shrink-0 border-t border-[#e8eaed] bg-white p-3 sm:p-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[#e4e7ec] bg-[#f8f9fa] px-3 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#e8f0fe] text-xs font-bold text-[#1a73e8]">
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
                className="orbit-compose-btn rounded-full px-4 py-2 text-sm font-bold text-white"
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
            className="rounded-lg px-3 py-1.5 text-[#1a73e8] hover:bg-[#e8f0fe]"
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
      data-theme="gmail"
      style={{ ["--orbit-gold" as string]: accent }}
    >
      {(!isWide && drawerOpen) ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50"
          aria-label="Close folders"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showSidebar ? sidebar : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          {readerFs ? null : topBar}

          <div className="flex min-h-0 flex-1 overflow-hidden bg-white">
            {showList ? listPane : null}
            {showReader ? readerPane : null}
          </div>
        </div>
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
              <h3 className="text-lg font-bold text-[#202124]">Advanced search</h3>
              <button type="button" onClick={() => setAdvancedOpen(false)} className="rounded-lg p-1 text-zinc-600 hover:bg-zinc-100">
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
                <label key={key} className="block text-xs text-zinc-600">
                  {label}
                  <input
                    value={adv[key]}
                    onChange={(e) => setAdv((a) => ({ ...a, [key]: e.target.value }))}
                    className="mt-1 h-9 w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 text-sm text-[#202124] outline-none focus:border-[#1a73e8]"
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
                  className="accent-[#1a73e8]"
                />
                Has attachment
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adv.unread}
                  onChange={(e) => setAdv((a) => ({ ...a, unread: e.target.checked }))}
                  className="accent-[#1a73e8]"
                />
                Unread
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adv.starred}
                  onChange={(e) => setAdv((a) => ({ ...a, starred: e.target.checked }))}
                  className="accent-[#1a73e8]"
                />
                Starred
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
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
                className="rounded-lg bg-[#1a73e8] px-4 py-2 text-sm font-bold text-white hover:bg-[#1557c0]"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sourceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-[#e4e7ec] bg-white text-[#202124] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-3">
              <h3 className="font-semibold text-[#202124]">Message source</h3>
              <button type="button" onClick={() => setSourceOpen(false)} className="rounded-lg p-1 hover:bg-zinc-100">
                <X className="size-4" />
              </button>
            </div>
            <pre className="orbit-scroll flex-1 overflow-auto whitespace-pre-wrap break-all bg-[#f8f9fa] p-4 text-xs text-[#202124]">
              {sourceText}
            </pre>
          </div>
        </div>
      ) : null}

      {folderDialog ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#e4e7ec] bg-white p-5 text-[#202124] shadow-2xl">
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
              className="mb-4 h-10 w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 text-sm text-[#202124] outline-none focus:border-[#1a73e8]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolderDialog(null)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={folderBusy}
                onClick={() => void submitFolderDialog()}
                className="rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-bold text-white hover:bg-[#1557c0] disabled:opacity-60"
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
