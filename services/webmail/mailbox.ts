/**
 * GLOBAL ORBIT MAIL — Mailbox operations over IMAP
 */

import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import type { ImapFlow } from "imapflow";
import { normalizeFolderPath, withImap } from "./imap-client";
import type { WebmailCredentials } from "./session-store";
import { sendMail, type SendMailInput } from "./smtp-client";

export type FolderDto = {
  path: string;
  name: string;
  delimiter: string;
  specialUse?: string | null;
  messages: number;
  unseen: number;
};

export type MessageListItem = {
  uid: number;
  seq: number;
  subject: string;
  from: string;
  fromEmail: string;
  date: string | null;
  preview: string;
  unseen: boolean;
  flagged: boolean;
  answered: boolean;
  hasAttachment: boolean;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
};

export type AttachmentMeta = {
  part: string;
  filename: string;
  contentType: string;
  size: number;
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
  attachments: AttachmentMeta[];
};

function addrListText(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (v && typeof v === "object" && "text" in v) return String((v as { text?: string }).text || "");
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object" && value && "text" in value) {
    return String((value as { text?: string }).text || "");
  }
  return String(value);
}

function addressText(value: unknown): { name: string; email: string } {
  if (!value) return { name: "", email: "" };
  if (Array.isArray(value) && value[0]) {
    const a = value[0] as { name?: string; address?: string };
    return { name: a.name || a.address || "", email: a.address || "" };
  }
  if (typeof value === "object" && value && "address" in value) {
    const a = value as { name?: string; address?: string };
    return { name: a.name || a.address || "", email: a.address || "" };
  }
  return { name: String(value), email: "" };
}

function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "span",
      "div",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
      a: ["href", "name", "target", "rel"],
      "*": ["style", "class"],
    },
    allowedSchemes: ["http", "https", "mailto", "cid", "data"],
  });
}

export async function listFolders(creds: WebmailCredentials): Promise<FolderDto[]> {
  return withImap(creds, async (client) => {
    const boxes = await client.list();
    const out: FolderDto[] = [];
    for (const box of boxes) {
      if (box.flags?.has("\\Noselect")) continue;
      let messages = 0;
      let unseen = 0;
      try {
        const status = await client.status(box.path, { messages: true, unseen: true });
        messages = status.messages ?? 0;
        unseen = status.unseen ?? 0;
      } catch {
        /* skip status errors */
      }
      out.push({
        path: box.path,
        name: box.name,
        delimiter: box.delimiter || "/",
        specialUse: box.specialUse || null,
        messages,
        unseen,
      });
    }
    return out.sort((a, b) => {
      const rank = (p: string) => {
        const u = p.toUpperCase();
        if (u === "INBOX") return 0;
        if (u.includes("SENT")) return 1;
        if (u.includes("DRAFT")) return 2;
        if (u.includes("JUNK") || u.includes("SPAM")) return 3;
        if (u.includes("TRASH") || u.includes("DELETED")) return 4;
        if (u.includes("ARCHIVE")) return 5;
        return 10;
      };
      return rank(a.path) - rank(b.path) || a.name.localeCompare(b.name);
    });
  });
}

export async function createFolder(creds: WebmailCredentials, name: string) {
  const path = name.replace(/^[/\\]+/, "").replace(/[/\\]+/g, "/").trim();
  if (!path || path.toUpperCase() === "INBOX") {
    throw Object.assign(new Error("Invalid folder name"), { status: 400 });
  }
  return withImap(creds, async (client) => {
    await client.mailboxCreate(path);
    return { path };
  });
}

export async function renameFolder(creds: WebmailCredentials, from: string, to: string) {
  const src = normalizeFolderPath(from);
  const dest = to.replace(/^[/\\]+/, "").replace(/[/\\]+/g, "/").trim();
  if (!src || !dest || src.toUpperCase() === "INBOX") {
    throw Object.assign(new Error("Cannot rename this folder"), { status: 400 });
  }
  return withImap(creds, async (client) => {
    await client.mailboxRename(src, dest);
    return { path: dest };
  });
}

export async function deleteFolder(creds: WebmailCredentials, pathInput: string) {
  const path = normalizeFolderPath(pathInput);
  if (!path || path.toUpperCase() === "INBOX") {
    throw Object.assign(new Error("Cannot delete Inbox"), { status: 400 });
  }
  return withImap(creds, async (client) => {
    const special = await client.list();
    const box = special.find((b) => b.path === path);
    if (box?.specialUse) {
      throw Object.assign(new Error("Cannot delete system folder"), { status: 400 });
    }
    await client.mailboxDelete(path);
    return { ok: true };
  });
}

export async function listMessages(
  creds: WebmailCredentials,
  folder: string,
  page = 1,
  pageSize = 50,
): Promise<{ messages: MessageListItem[]; total: number; page: number; pageSize: number }> {
  const path = normalizeFolderPath(folder);
  return withImap(creds, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      const mailbox = client.mailbox as { exists?: number } | false | null | undefined;
      const total = mailbox && typeof mailbox === "object" ? Number(mailbox.exists ?? 0) : 0;
      if (total === 0) {
        return { messages: [], total: 0, page, pageSize };
      }
      const end = Math.max(1, total - (page - 1) * pageSize);
      const start = Math.max(1, end - pageSize + 1);
      const range = `${start}:${end}`;
      const messages: MessageListItem[] = [];

      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
        source: { start: 0, maxLength: 800 },
      })) {
        const from = addressText(msg.envelope?.from);
        const subject = msg.envelope?.subject || "(no subject)";
        let preview = "";
        try {
          if (msg.source) {
            const parsed = await simpleParser(msg.source);
            preview = (parsed.text || "").replace(/\s+/g, " ").trim().slice(0, 140);
          }
        } catch {
          preview = "";
        }
        const flags = msg.flags || new Set<string>();
        const messageId = msg.envelope?.messageId || undefined;
        const inReplyToRaw = msg.envelope?.inReplyTo;
        const inReplyTo = Array.isArray(inReplyToRaw)
          ? inReplyToRaw[0]
          : typeof inReplyToRaw === "string"
            ? inReplyToRaw
            : undefined;
        const references = undefined;
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject,
          from: from.name,
          fromEmail: from.email,
          date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
          preview,
          unseen: !flags.has("\\Seen"),
          flagged: flags.has("\\Flagged"),
          answered: flags.has("\\Answered"),
          hasAttachment: hasAttachmentStructure(msg.bodyStructure),
          messageId,
          inReplyTo,
          references,
          threadId: resolveThreadId(messageId, inReplyTo, references, subject),
        });
      }

      messages.sort((a, b) => b.uid - a.uid);
      return { messages, total, page, pageSize };
    } finally {
      lock.release();
    }
  });
}

function headerValue(headers: unknown, key: string): string | undefined {
  if (!headers) return undefined;
  const lower = key.toLowerCase();
  if (headers instanceof Map) {
    const vals = headers.get(key) ?? headers.get(lower);
    const first = Array.isArray(vals) ? vals[0] : vals;
    return typeof first === "string" ? first.trim() || undefined : undefined;
  }
  if (Buffer.isBuffer(headers)) {
    const text = headers.toString("utf8");
    const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, "im");
    const m = text.match(re);
    return m?.[1]?.trim() || undefined;
  }
  if (typeof headers === "object") {
    const obj = headers as Record<string, unknown>;
    const raw = obj[key] ?? obj[lower] ?? obj[key.replace(/-/g, "")];
    if (Array.isArray(raw)) return String(raw[0] ?? "").trim() || undefined;
    if (typeof raw === "string") return raw.trim() || undefined;
  }
  return undefined;
}

function normalizeMsgId(id?: string) {
  if (!id) return undefined;
  return id.replace(/^<|>$/g, "").trim().toLowerCase();
}

export function resolveThreadId(messageId?: string, inReplyTo?: string, references?: string, subject?: string) {
  const refs = references?.split(/\s+/).filter(Boolean) ?? [];
  const firstRef = refs[0] ? normalizeMsgId(refs[0]) : undefined;
  const reply = normalizeMsgId(inReplyTo);
  const self = normalizeMsgId(messageId);
  if (firstRef || reply || self) return firstRef || reply || self;
  if (subject) {
    const normalized = subject.replace(/^(re|fw|fwd)\s*:\s*/gi, "").trim().toLowerCase();
    if (normalized) return `subj:${normalized}`;
  }
  return undefined;
}

function hasAttachmentStructure(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as {
    disposition?: string | null;
    type?: string;
    childNodes?: unknown[];
  };
  if (n.disposition === "attachment") return true;
  if (Array.isArray(n.childNodes)) {
    return n.childNodes.some((c) => hasAttachmentStructure(c));
  }
  return false;
}

export type ThreadListItem = {
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

export async function listThreads(
  creds: WebmailCredentials,
  folder: string,
  page = 1,
  pageSize = 50,
) {
  const fetchSize = 500;
  const { messages, total: mailboxTotal } = await listMessages(creds, folder, 1, fetchSize);
  const threadMap = new Map<string, ThreadListItem & { uids: number[] }>();

  for (const m of messages) {
    const tid = m.threadId || `uid-${m.uid}`;
    const existing = threadMap.get(tid);
    if (!existing) {
      threadMap.set(tid, {
        threadId: tid,
        subject: m.subject,
        participants: [m.fromEmail || m.from].filter(Boolean),
        lastDate: m.date,
        messageCount: 1,
        unseenCount: m.unseen ? 1 : 0,
        latestUid: m.uid,
        preview: m.preview,
        flagged: m.flagged,
        uids: [m.uid],
      });
      continue;
    }
    existing.messageCount++;
    if (m.unseen) existing.unseenCount++;
    if (m.flagged) existing.flagged = true;
    existing.uids.push(m.uid);
    const email = m.fromEmail || m.from;
    if (email && !existing.participants.includes(email)) existing.participants.push(email);
    if (m.date && (!existing.lastDate || m.date > existing.lastDate)) {
      existing.lastDate = m.date;
      existing.latestUid = m.uid;
      existing.preview = m.preview || existing.preview;
      if (m.subject && m.subject !== "(no subject)") existing.subject = m.subject;
    }
  }

  const threads = [...threadMap.values()]
    .map(({ uids, ...rest }) => rest)
    .sort((a, b) => {
      const da = a.lastDate ? Date.parse(a.lastDate) : 0;
      const db = b.lastDate ? Date.parse(b.lastDate) : 0;
      return db - da;
    });

  const start = (page - 1) * pageSize;
  return {
    threads: threads.slice(start, start + pageSize),
    total: threads.length,
    page,
    pageSize,
    mailboxTotal,
  };
}

export async function getThreadMessages(
  creds: WebmailCredentials,
  folder: string,
  threadId: string,
  anchorUid?: number,
) {
  const { messages } = await listMessages(creds, folder, 1, 500);
  let anchor = messages.find((m) => m.uid === anchorUid);
  if (!anchor && anchorUid) {
    anchor = messages.find((m) => m.threadId === threadId || String(m.uid) === threadId);
  }
  const tid = anchor?.threadId || threadId;
  const inThread = messages.filter((m) => m.threadId === tid || normalizeMsgId(m.messageId) === tid);
  const sorted = inThread.sort((a, b) => (a.date && b.date ? Date.parse(a.date) - Date.parse(b.date) : a.uid - b.uid));
  const details = await Promise.all(sorted.map((m) => getMessage(creds, folder, m.uid)));
  return { threadId: tid, messages: details };
}

export async function getMessage(
  creds: WebmailCredentials,
  folder: string,
  uid: number,
): Promise<MessageDetail> {
  const path = normalizeFolderPath(folder);
  return withImap(creds, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      const raw = await client.fetchOne(
        String(uid),
        { source: true, uid: true, flags: true, envelope: true, bodyStructure: true },
        { uid: true },
      );
      const msg = raw && typeof raw === "object" ? raw : null;
      if (!msg || !("source" in msg) || !msg.source) {
        throw Object.assign(new Error("Message not found"), { status: 404 });
      }
      const parsed = await simpleParser(msg.source);
      const from = addressText(parsed.from?.value || msg.envelope?.from);
      const to = addrListText(parsed.to);
      const cc = addrListText(parsed.cc);
      const attachments: AttachmentMeta[] = (parsed.attachments || []).map((a, i) => ({
        part: String(i),
        filename: a.filename || `attachment-${i + 1}`,
        contentType: a.contentType || "application/octet-stream",
        size: a.size || a.content?.length || 0,
      }));

      // Mark seen
      try {
        await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
      } catch {
        /* ignore */
      }

      return {
        uid,
        folder: path,
        subject: parsed.subject || msg.envelope?.subject || "(no subject)",
        from: from.name,
        fromEmail: from.email,
        to,
        cc,
        date: parsed.date ? parsed.date.toISOString() : null,
        text: parsed.text || "",
        html: cleanHtml(parsed.html || (parsed.textAsHtml || "")),
        messageId: parsed.messageId,
        attachments,
      };
    } finally {
      lock.release();
    }
  });
}

export async function getAttachment(
  creds: WebmailCredentials,
  folder: string,
  uid: number,
  partIndex: number,
): Promise<{ filename: string; contentType: string; content: Buffer }> {
  const path = normalizeFolderPath(folder);
  return withImap(creds, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      const raw = await client.fetchOne(String(uid), { source: true, uid: true }, { uid: true });
      const msg = raw && typeof raw === "object" ? raw : null;
      if (!msg || !("source" in msg) || !msg.source) {
        throw Object.assign(new Error("Message not found"), { status: 404 });
      }
      const parsed = await simpleParser(msg.source as Buffer);
      const att = parsed.attachments?.[partIndex];
      if (!att) throw Object.assign(new Error("Attachment not found"), { status: 404 });
      return {
        filename: att.filename || `attachment-${partIndex + 1}`,
        contentType: att.contentType || "application/octet-stream",
        content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content),
      };
    } finally {
      lock.release();
    }
  });
}

export type MessageAction =
  | { type: "delete"; folder: string; uids: number[] }
  | { type: "move"; folder: string; uids: number[]; target: string }
  | { type: "copy"; folder: string; uids: number[]; target: string }
  | { type: "flag"; folder: string; uids: number[]; flagged: boolean }
  | { type: "seen"; folder: string; uids: number[]; seen: boolean };

async function findSpecialFolder(client: ImapFlow, kind: "Trash" | "Junk" | "Archive" | "Drafts" | "Sent") {
  const boxes = await client.list();
  const special = boxes.find((b) => b.specialUse === `\\${kind}`);
  if (special) return special.path;
  const hint = kind.toUpperCase();
  const fuzzy = boxes.find((b) => b.path.toUpperCase().includes(hint) || b.name.toUpperCase().includes(hint));
  return fuzzy?.path || null;
}

export async function applyMessageAction(creds: WebmailCredentials, action: MessageAction) {
  return withImap(creds, async (client) => {
    const folder = normalizeFolderPath(action.folder);
    const lock = await client.getMailboxLock(folder);
    try {
      const uidSet = action.uids.join(",");
      if (action.type === "seen") {
        if (action.seen) await client.messageFlagsAdd(uidSet, ["\\Seen"], { uid: true });
        else await client.messageFlagsRemove(uidSet, ["\\Seen"], { uid: true });
        return { ok: true };
      }
      if (action.type === "flag") {
        if (action.flagged) await client.messageFlagsAdd(uidSet, ["\\Flagged"], { uid: true });
        else await client.messageFlagsRemove(uidSet, ["\\Flagged"], { uid: true });
        return { ok: true };
      }
      if (action.type === "move") {
        await client.messageMove(uidSet, action.target, { uid: true });
        return { ok: true };
      }
      if (action.type === "copy") {
        await client.messageCopy(uidSet, action.target, { uid: true });
        return { ok: true };
      }
      if (action.type === "delete") {
        const trash = (await findSpecialFolder(client, "Trash")) || "Trash";
        if (folder.toUpperCase().includes("TRASH") || folder.toUpperCase().includes("DELETED")) {
          await client.messageDelete(uidSet, { uid: true });
        } else {
          await client.messageMove(uidSet, trash, { uid: true });
        }
        return { ok: true, target: trash };
      }
      return { ok: false };
    } finally {
      lock.release();
    }
  });
}

export async function sendAndStore(
  creds: WebmailCredentials,
  input: SendMailInput & { saveSent?: boolean; skipSignature?: boolean },
) {
  const { getMailboxBrandingByEmail, buildOutgoingSignatureHtml } = await import("./branding");
  const branding = await getMailboxBrandingByEmail(creds.email);
  const fromName = branding?.displayName || creds.email.split("@")[0] || creds.email;
  const from = `"${fromName.replace(/"/g, "")}" <${creds.email}>`;

  let text = input.text;
  let html = input.html;
  if (!input.skipSignature && branding) {
    const sigHtml = buildOutgoingSignatureHtml(branding);
    const sigText =
      branding.signatureText?.trim() ||
      [branding.displayName, branding.jobTitle, branding.company || branding.domainCompanyName, branding.email]
        .filter(Boolean)
        .join("\n");
    if (html?.trim()) {
      html = `${html}<br/>${sigHtml}`;
    } else if (text?.trim()) {
      html = `<div style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeForHtml(text)}</div>${sigHtml}`;
      text = `${text}\n\n--\n${sigText}`;
    } else {
      html = sigHtml;
      text = sigText;
    }
  }

  const result = await sendMail(
    creds,
    { ...input, text, html },
    { from },
  );
  let sentSaved = false;
  let sentError: string | undefined;
  if (input.saveSent !== false) {
    try {
      await withImap(creds, async (client) => {
        const sent = (await findSpecialFolder(client, "Sent")) || "Sent";
        await client.append(sent, result.rawForStore, ["\\Seen"]);
      });
      sentSaved = true;
    } catch (error) {
      sentError = error instanceof Error ? error.message : "Failed to append to Sent";
    }
  }

  const { bumpMailDailyStat } = await import("@/lib/mail/daily-stats");
  void bumpMailDailyStat("sentCount").catch(() => undefined);

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    smtpResponse: result.response,
    smtpCode: result.responseCode ?? 250,
    sentSaved,
    sentError,
  };
}

function escapeForHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function saveDraft(creds: WebmailCredentials, input: SendMailInput) {
  return withImap(creds, async (client) => {
    const drafts = (await findSpecialFolder(client, "Drafts")) || "Drafts";
    const { buildRfc822 } = await import("./smtp-client");
    const raw = await buildRfc822(creds.email, input, { includeBcc: false });
    const info = await client.append(drafts, raw, ["\\Draft"]);
    const uid = info && typeof info === "object" && "uid" in info ? Number(info.uid) : undefined;
    return { uid, path: drafts };
  });
}

export async function searchMessages(
  creds: WebmailCredentials,
  folder: string,
  query: string,
  opts?: { from?: string; to?: string; since?: string; hasAttachment?: boolean },
): Promise<MessageListItem[]> {
  const path = normalizeFolderPath(folder);
  // Support operators in q: from:x to:y since:YYYY-MM-DD has:attachment
  let q = query.trim();
  const parsed = { ...opts };
  const fromMatch = q.match(/\bfrom:(\S+)/i);
  if (fromMatch) {
    parsed.from = parsed.from || fromMatch[1];
    q = q.replace(fromMatch[0], "").trim();
  }
  const toMatch = q.match(/\bto:(\S+)/i);
  if (toMatch) {
    parsed.to = parsed.to || toMatch[1];
    q = q.replace(toMatch[0], "").trim();
  }
  const sinceMatch = q.match(/\bsince:(\S+)/i);
  if (sinceMatch) {
    parsed.since = parsed.since || sinceMatch[1];
    q = q.replace(sinceMatch[0], "").trim();
  }
  if (/\bhas:attachment\b/i.test(q)) {
    parsed.hasAttachment = true;
    q = q.replace(/\bhas:attachment\b/i, "").trim();
  }

  return withImap(creds, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      const criteria: Record<string, unknown> = {};
      if (parsed.from) criteria.from = parsed.from;
      if (parsed.to) criteria.to = parsed.to;
      if (parsed.since) {
        const d = new Date(parsed.since);
        if (!Number.isNaN(d.getTime())) criteria.since = d;
      }

      let uids: number[] = [];
      if (q) {
        // Run separate searches and union — more reliable than nested OR across servers
        const parts = await Promise.all([
          client.search({ ...criteria, subject: q }, { uid: true }),
          client.search({ ...criteria, body: q }, { uid: true }),
          client.search({ ...criteria, from: q }, { uid: true }),
          client.search({ ...criteria, to: q }, { uid: true }),
        ]);
        const set = new Set<number>();
        for (const part of parts) {
          if (part) for (const uid of part) set.add(uid);
        }
        uids = [...set];
      } else if (Object.keys(criteria).length) {
        const found = await client.search(criteria, { uid: true });
        uids = found || [];
      } else if (parsed.hasAttachment) {
        const status = await client.status(path, { messages: true });
        const exists = status.messages || 0;
        if (exists === 0) return [];
        const start = Math.max(1, exists - 200);
        for await (const msg of client.fetch(`${start}:*`, { uid: true })) {
          uids.push(msg.uid);
        }
      } else {
        return [];
      }

      if (uids.length === 0) return [];
      const slice = uids.slice(-100);
      const messages: MessageListItem[] = [];
      for await (const msg of client.fetch(
        slice,
        { uid: true, flags: true, envelope: true, bodyStructure: true },
        { uid: true },
      )) {
        const env = msg.envelope;
        const from = addressText(env?.from);
        const flags = msg.flags || new Set<string>();
        const hasAttachment = (() => {
          const walk = (node: unknown): boolean => {
            if (!node || typeof node !== "object") return false;
            const n = node as { disposition?: string; childNodes?: unknown[] };
            if (String(n.disposition || "").toLowerCase() === "attachment") return true;
            if (Array.isArray(n.childNodes)) return n.childNodes.some(walk);
            return false;
          };
          return walk(msg.bodyStructure);
        })();
        if (parsed.hasAttachment && !hasAttachment) continue;
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: env?.subject || "(no subject)",
          from: from.name,
          fromEmail: from.email,
          date: env?.date ? new Date(env.date).toISOString() : null,
          preview: "",
          unseen: !flags.has("\\Seen"),
          flagged: flags.has("\\Flagged"),
          answered: flags.has("\\Answered"),
          hasAttachment,
        });
      }
      return messages.reverse();
    } finally {
      lock.release();
    }
  });
}

/** Recent recipient emails from Sent + INBOX envelopes for autocomplete. */
export async function listRecentRecipients(creds: WebmailCredentials, limit = 40): Promise<string[]> {
  return withImap(creds, async (client) => {
    const found = new Set<string>();
    const scan = async (folderHint: string) => {
      try {
        const special =
          folderHint === "Sent"
            ? (await findSpecialFolder(client, "Sent")) || "Sent"
            : normalizeFolderPath(folderHint);
        const path = normalizeFolderPath(special);
        const lock = await client.getMailboxLock(path);
        try {
          const status = await client.status(path, { messages: true });
          const exists = status.messages || 0;
          if (exists === 0) return;
          const start = Math.max(1, exists - 40);
          for await (const msg of client.fetch(`${start}:*`, { envelope: true })) {
            for (const field of [msg.envelope?.to, msg.envelope?.cc, msg.envelope?.from] as const) {
              for (const a of field || []) {
                if (a.address && a.address.toLowerCase() !== creds.email.toLowerCase()) {
                  found.add(a.address.toLowerCase());
                }
              }
            }
          }
        } finally {
          lock.release();
        }
      } catch {
        /* folder may not exist */
      }
    };
    await scan("Sent");
    await scan("INBOX");
    return [...found].slice(0, limit);
  });
}

export async function spamOrArchive(
  creds: WebmailCredentials,
  folder: string,
  uids: number[],
  kind: "Junk" | "Archive",
) {
  const result = await withImap(creds, async (client) => {
    const target = (await findSpecialFolder(client, kind)) || kind;
    const lock = await client.getMailboxLock(normalizeFolderPath(folder));
    try {
      await client.messageMove(uids.join(","), target, { uid: true });
      return { ok: true, target };
    } finally {
      lock.release();
    }
  });

  if (kind === "Junk") {
    const { bumpMailDailyStat } = await import("@/lib/mail/daily-stats");
    void bumpMailDailyStat("spamActionCount", uids.length).catch(() => undefined);
  }

  return result;
}
