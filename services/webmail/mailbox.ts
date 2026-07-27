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
        });
      }

      messages.sort((a, b) => b.uid - a.uid);
      return { messages, total, page, pageSize };
    } finally {
      lock.release();
    }
  });
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

export async function searchMessages(
  creds: WebmailCredentials,
  folder: string,
  query: string,
): Promise<MessageListItem[]> {
  const path = normalizeFolderPath(folder);
  const q = query.trim();
  if (!q) return [];
  return withImap(creds, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      const uids = await client.search({ or: [{ subject: q }, { body: q }, { from: q }] }, { uid: true });
      if (!uids || uids.length === 0) return [];
      const slice = uids.slice(-50);
      const messages: MessageListItem[] = [];
      for await (const msg of client.fetch(slice, { uid: true, flags: true, envelope: true }, { uid: true })) {
        const from = addressText(msg.envelope?.from);
        const flags = msg.flags || new Set<string>();
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: msg.envelope?.subject || "(no subject)",
          from: from.name,
          fromEmail: from.email,
          date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
          preview: "",
          unseen: !flags.has("\\Seen"),
          flagged: flags.has("\\Flagged"),
          answered: flags.has("\\Answered"),
          hasAttachment: false,
        });
      }
      return messages.sort((a, b) => b.uid - a.uid);
    } finally {
      lock.release();
    }
  });
}

export async function sendAndStore(
  creds: WebmailCredentials,
  input: SendMailInput & { saveSent?: boolean },
) {
  const result = await sendMail(creds, input);
  if (input.saveSent !== false) {
    try {
      await withImap(creds, async (client) => {
        const sent = (await findSpecialFolder(client, "Sent")) || "Sent";
        const raw = buildSimpleRfc822(creds.email, input);
        await client.append(sent, raw, ["\\Seen"]);
      });
    } catch {
      /* sent folder optional */
    }
  }
  return result;
}

export async function saveDraft(creds: WebmailCredentials, input: SendMailInput) {
  return withImap(creds, async (client) => {
    const drafts = (await findSpecialFolder(client, "Drafts")) || "Drafts";
    const raw = buildSimpleRfc822(creds.email, input);
    const info = await client.append(drafts, raw, ["\\Draft"]);
    const uid = info && typeof info === "object" && "uid" in info ? Number(info.uid) : undefined;
    return { uid, path: drafts };
  });
}

function buildSimpleRfc822(from: string, input: SendMailInput) {
  const to = Array.isArray(input.to) ? input.to.join(", ") : input.to;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${input.subject || ""}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.text || (input.html ? input.html.replace(/<[^>]+>/g, " ") : ""),
  ];
  return headers.join("\r\n");
}

export async function spamOrArchive(
  creds: WebmailCredentials,
  folder: string,
  uids: number[],
  kind: "Junk" | "Archive",
) {
  return withImap(creds, async (client) => {
    const target = (await findSpecialFolder(client, kind)) || kind;
    const lock = await client.getMailboxLock(normalizeFolderPath(folder));
    try {
      await client.messageMove(uids.join(","), target, { uid: true });
      return { ok: true, target };
    } finally {
      lock.release();
    }
  });
}
