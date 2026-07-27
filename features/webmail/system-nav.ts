/**
 * Canonical enterprise mailbox navigation — Image 2 parity.
 * Maps UI keys to real IMAP SPECIAL-USE / conventional folder paths.
 */

export type SystemNavKey =
  | "inbox"
  | "starred"
  | "important"
  | "snoozed"
  | "sent"
  | "drafts"
  | "spam"
  | "trash"
  | "archive";

export type SystemNavItem = {
  key: SystemNavKey;
  label: string;
  /** Real IMAP folder path when applicable; null = virtual view */
  virtual?: "starred" | "important";
  specialHints: string[];
  defaultPath: string;
  color: string;
};

export const SYSTEM_NAV: SystemNavItem[] = [
  {
    key: "inbox",
    label: "Inbox",
    specialHints: ["\\INBOX", "INBOX"],
    defaultPath: "INBOX",
    color: "#d4af37",
  },
  {
    key: "starred",
    label: "Starred",
    virtual: "starred",
    specialHints: ["\\FLAGGED", "FLAGGED", "STARRED"],
    defaultPath: "Starred",
    color: "#f0d78c",
  },
  {
    key: "important",
    label: "Important",
    specialHints: ["IMPORTANT", "\\IMPORTANT"],
    defaultPath: "Important",
    color: "#e8a838",
  },
  {
    key: "snoozed",
    label: "Snoozed",
    specialHints: ["SNOOZED"],
    defaultPath: "Snoozed",
    color: "#8b9bb4",
  },
  {
    key: "sent",
    label: "Sent",
    specialHints: ["\\SENT", "SENT"],
    defaultPath: "Sent",
    color: "#5b8def",
  },
  {
    key: "drafts",
    label: "Drafts",
    specialHints: ["\\DRAFTS", "DRAFT"],
    defaultPath: "Drafts",
    color: "#a78bfa",
  },
  {
    key: "spam",
    label: "Spam",
    specialHints: ["\\JUNK", "JUNK", "SPAM"],
    defaultPath: "Junk",
    color: "#f87171",
  },
  {
    key: "trash",
    label: "Trash",
    specialHints: ["\\TRASH", "TRASH", "DELETED"],
    defaultPath: "Trash",
    color: "#94a3b8",
  },
  {
    key: "archive",
    label: "Archive",
    specialHints: ["\\ARCHIVE", "ARCHIVE"],
    defaultPath: "Archive",
    color: "#34d399",
  },
];

export function matchSystemFolder(
  folders: Array<{ path: string; name: string; specialUse?: string | null }>,
  item: SystemNavItem,
): { path: string; name: string; specialUse?: string | null } | null {
  if (item.virtual) return null;
  if (item.key === "inbox") {
    return folders.find((f) => f.path.toUpperCase() === "INBOX") ?? { path: "INBOX", name: "INBOX" };
  }
  for (const f of folders) {
    const special = (f.specialUse || "").toUpperCase();
    const path = (f.path || "").toUpperCase();
    const name = (f.name || "").toUpperCase();
    for (const hint of item.specialHints) {
      const h = hint.toUpperCase().replace(/^\\/, "");
      if (special.includes(h) || path === h || path.endsWith(`/${h}`) || path.endsWith(`.${h}`) || name === h) {
        return f;
      }
    }
  }
  return null;
}

export function isReservedSystemPath(path: string) {
  const u = path.toUpperCase();
  if (u === "INBOX") return true;
  return SYSTEM_NAV.some((item) => {
    if (item.virtual) return false;
    return item.specialHints.some((h) => {
      const hint = h.toUpperCase().replace(/^\\/, "");
      return u === hint || u.endsWith(`/${hint}`) || u.endsWith(`.${hint}`);
    });
  });
}
