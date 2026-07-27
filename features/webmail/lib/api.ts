export async function webmailApi<T>(url: string, init?: RequestInit): Promise<T> {
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

export function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export type Folder = {
  path: string;
  name: string;
  unseen: number;
  messages: number;
  specialUse?: string | null;
  delimiter?: string;
};

export type MessageItem = {
  uid: number;
  subject: string;
  from: string;
  fromEmail: string;
  date: string | null;
  preview: string;
  unseen: boolean;
  flagged: boolean;
  hasAttachment: boolean;
  threadId?: string;
};

export type ThreadItem = {
  threadId: string;
  subject: string;
  participants: string[];
  lastDate: string | null;
  messageCount: number;
  unseenCount: number;
  latestUid: number;
  preview: string;
  flagged: boolean;
};

export type MessageDetail = {
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

export type MeBranding = {
  displayName: string;
  jobTitle: string | null;
  company: string | null;
  phone: string | null;
  website: string | null;
  signatureHtml: string | null;
  signatureText: string | null;
  avatarUrl: string | null;
  domainLogoDataUrl: string | null;
  domainCompanyName: string | null;
  brandColor: string | null;
  quotaMb: number;
  usedMb: number;
  replyTo: string | null;
  timezone: string | null;
  language: string | null;
};

export type Me = {
  email: string;
  name: string;
  online: boolean;
  branding: MeBranding | null;
};

export function isSystemFolder(f: Folder) {
  const path = (f.path || "").toUpperCase();
  if (path === "INBOX") return true;
  return Boolean(f.specialUse);
}

export function folderIconLabel(f: Folder) {
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

export function formatStorageMb(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}
