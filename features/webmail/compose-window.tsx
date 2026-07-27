"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bold,
  Italic,
  Link2,
  List,
  Paperclip,
  Send,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { webmailApi } from "@/features/webmail/lib/api";

export type ComposeAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentBase64: string;
  progress: number;
};

export type ComposeState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  html?: string;
  mode: "new" | "reply" | "replyAll" | "forward";
  inReplyTo?: string;
  references?: string;
  attachments: ComposeAttachment[];
};

const MAX_ATTACH_BYTES = 25 * 1024 * 1024;

function fileToBase64(file: File, onProgress: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    reader.onload = () => {
      const result = String(reader.result || "");
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      onProgress(100);
      resolve(b64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string) {
  return `<div style="white-space:pre-wrap;font-family:Inter,system-ui,sans-serif">${escapeHtml(text)}</div>`;
}

function htmlToPlain(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.innerText || tmp.textContent || "").replace(/\u00a0/g, " ").trimEnd();
}

function buildSignatureBlock(signatureHtml?: string | null, signatureText?: string | null) {
  if (signatureHtml?.trim()) {
    return { html: `<br/><div data-orbit-sig="1">${signatureHtml.trim()}</div>`, text: "" };
  }
  if (signatureText?.trim()) {
    const t = signatureText.trim();
    return {
      html: `<br/><div data-orbit-sig="1" style="white-space:pre-wrap">${escapeHtml(t)}</div>`,
      text: `\n\n--\n${t}`,
    };
  }
  return null;
}

export function ComposeWindow({
  open,
  initial,
  recentRecipients,
  mobile,
  signatureHtml,
  signatureText,
  onClose,
  onSent,
}: {
  open: boolean;
  initial: ComposeState;
  recentRecipients: string[];
  mobile?: boolean;
  signatureHtml?: string | null;
  signatureText?: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [compose, setCompose] = React.useState(initial);
  const [showCc, setShowCc] = React.useState(Boolean(initial.cc));
  const [showBcc, setShowBcc] = React.useState(Boolean(initial.bcc));
  const [sending, setSending] = React.useState(false);
  const [draftSaving, setDraftSaving] = React.useState(false);
  const [toFocus, setToFocus] = React.useState(false);
  const [clientSignature, setClientSignature] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [size, setSize] = React.useState({ w: 672, h: 640 });
  const fileRef = React.useRef<HTMLInputElement>(null);
  const editorRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const resizeRef = React.useRef<{ ox: number; oy: number; w: number; h: number } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPos({ x: 0, y: 0 });
    setSize({ w: Math.min(672, typeof window !== "undefined" ? window.innerWidth - 32 : 672), h: 640 });

    let body = initial.body;
    let html = initial.html;
    let usedSig = false;

    if (initial.mode === "new" && !initial.body.trim() && !initial.html?.trim()) {
      const sig = buildSignatureBlock(signatureHtml, signatureText);
      if (sig) {
        body = sig.text;
        html = sig.html;
        usedSig = true;
      }
    } else if (!html && body) {
      html = textToHtml(body);
    }

    setCompose({ ...initial, body, html });
    setClientSignature(usedSig);
    setShowCc(Boolean(initial.cc));
    setShowBcc(Boolean(initial.bcc));

    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = html || (body ? textToHtml(body) : "<div><br/></div>");
      }
    });
  }, [open, initial, signatureHtml, signatureText]);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      syncFromEditor();
      const c = composeRef.current;
      if (!c.to && !c.subject && !c.body && c.attachments.length === 0) return;
      void saveDraft(true);
    }, 45_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const composeRef = React.useRef(compose);
  React.useEffect(() => {
    composeRef.current = compose;
  }, [compose]);

  const suggestions = React.useMemo(() => {
    const q = compose.to.split(",").pop()?.trim().toLowerCase() || "";
    if (!q || q.length < 1) return [];
    return recentRecipients.filter((e) => e.includes(q)).slice(0, 6);
  }, [compose.to, recentRecipients]);

  function syncFromEditor() {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    const text = htmlToPlain(html);
    setCompose((c) => ({ ...c, html, body: text }));
    composeRef.current = { ...composeRef.current, html, body: text };
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    syncFromEditor();
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (!url?.trim()) return;
    exec("createLink", url.trim());
  }

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > MAX_ATTACH_BYTES) {
        toast.error(`Attachment too large: ${file.name} (max 25 MB)`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setCompose((c) => ({
        ...c,
        attachments: [
          ...c.attachments,
          {
            id,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
            contentBase64: "",
            progress: 5,
          },
        ],
      }));
      try {
        const contentBase64 = await fileToBase64(file, (progress) => {
          setCompose((c) => ({
            ...c,
            attachments: c.attachments.map((a) => (a.id === id ? { ...a, progress } : a)),
          }));
        });
        setCompose((c) => ({
          ...c,
          attachments: c.attachments.map((a) =>
            a.id === id ? { ...a, contentBase64, progress: 100 } : a,
          ),
        }));
      } catch {
        toast.error(`Attachment upload failed: ${file.name}`);
        setCompose((c) => ({ ...c, attachments: c.attachments.filter((a) => a.id !== id) }));
      }
    }
  }

  async function saveDraft(silent = false) {
    if (draftSaving) return;
    syncFromEditor();
    const c = composeRef.current;
    setDraftSaving(true);
    try {
      await webmailApi("/api/webmail/messages/draft", {
        method: "POST",
        body: JSON.stringify({
          to: c.to,
          cc: c.cc || undefined,
          bcc: c.bcc || undefined,
          subject: c.subject,
          text: c.body,
          html: c.html || undefined,
          inReplyTo: c.inReplyTo,
          references: c.references,
          attachments: c.attachments
            .filter((a) => a.contentBase64)
            .map((a) => ({
              filename: a.filename,
              contentBase64: a.contentBase64,
              contentType: a.contentType,
            })),
        }),
      });
      if (!silent) toast.success("Draft saved");
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDraftSaving(false);
    }
  }

  async function send() {
    syncFromEditor();
    const c = composeRef.current;
    if (!c.to.trim()) {
      toast.error("Add at least one To recipient");
      return;
    }
    if (!c.body.trim() && c.attachments.length === 0) {
      toast.error("Message body required");
      return;
    }
    const pending = c.attachments.some((a) => a.progress < 100 || !a.contentBase64);
    if (pending) {
      toast.error("Wait for attachments to finish uploading");
      return;
    }
    setSending(true);
    const toastId = toast.loading("Sending…");
    try {
      const data = await webmailApi<{
        accepted: string[];
        rejected: string[];
        smtpResponse: string;
        smtpCode: number;
        sentSaved: boolean;
        sentError?: string;
        messageId: string;
      }>("/api/webmail/messages/send", {
        method: "POST",
        body: JSON.stringify({
          to: c.to,
          cc: c.cc || undefined,
          bcc: c.bcc || undefined,
          subject: c.subject,
          text: c.body,
          html: c.html || textToHtml(c.body),
          skipSignature: clientSignature,
          inReplyTo: c.mode.startsWith("reply") ? c.inReplyTo : undefined,
          references: c.references,
          attachments: c.attachments.map((a) => ({
            filename: a.filename,
            contentBase64: a.contentBase64,
            contentType: a.contentType,
          })),
        }),
      });
      const rejected = data.rejected?.length ? ` Rejected: ${data.rejected.join(", ")}` : "";
      const sentNote = data.sentSaved
        ? " Saved to Sent."
        : data.sentError
          ? ` Warning: Sent folder — ${data.sentError}`
          : "";
      toast.success(`Sent successfully (${data.smtpResponse || "250 OK"}).${sentNote}${rejected}`, {
        id: toastId,
        duration: 5000,
      });
      onSent();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed", { id: toastId, duration: 8000 });
    } finally {
      setSending(false);
    }
  }

  function onHeaderPointerDown(e: React.PointerEvent) {
    if (mobile) return;
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onHeaderPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.ox;
    const dy = e.clientY - dragRef.current.oy;
    setPos({ x: dragRef.current.px + dx, y: dragRef.current.py + dy });
  }

  function onHeaderPointerUp() {
    dragRef.current = null;
  }

  function onResizePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { ox: e.clientX, oy: e.clientY, w: size.w, h: size.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizePointerMove(e: React.PointerEvent) {
    if (!resizeRef.current) return;
    const dw = e.clientX - resizeRef.current.ox;
    const dh = e.clientY - resizeRef.current.oy;
    setSize({
      w: Math.max(420, Math.min(960, resizeRef.current.w + dw)),
      h: Math.max(420, Math.min(900, resizeRef.current.h + dh)),
    });
  }

  function onResizePointerUp() {
    resizeRef.current = null;
  }

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        style={
          mobile
            ? undefined
            : {
                width: size.w,
                height: size.h,
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                maxWidth: "96vw",
                maxHeight: "92vh",
              }
        }
        className={cn(
          "relative flex flex-col overflow-hidden border border-[#d4af37]/25 bg-[#0e0e16] shadow-2xl",
          mobile ? "h-[92dvh] w-full rounded-t-2xl" : "rounded-2xl",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-white/10 bg-[#12121a] px-4 py-3",
            !mobile && "cursor-grab active:cursor-grabbing",
          )}
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <p className="font-semibold select-none">
            {compose.mode === "new"
              ? "New Message"
              : compose.mode === "forward"
                ? "Forward"
                : compose.mode === "replyAll"
                  ? "Reply All"
                  : "Reply"}
          </p>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-white/5">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-white/10 px-4 py-3">
          <div className="relative flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-zinc-500">To</span>
            <input
              value={compose.to}
              onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
              onFocus={() => setToFocus(true)}
              onBlur={() => window.setTimeout(() => setToFocus(false), 150)}
              list="orbit-recipients"
              placeholder="name@domain.com, …"
              className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/6"
            />
            <button type="button" className="text-xs text-[#f0d78c]" onClick={() => setShowCc((v) => !v)}>
              Cc
            </button>
            <button type="button" className="text-xs text-[#f0d78c]" onClick={() => setShowBcc((v) => !v)}>
              Bcc
            </button>
            {toFocus && suggestions.length > 0 ? (
              <div className="absolute left-10 right-16 top-10 z-10 overflow-hidden rounded-lg border border-white/10 bg-[#12121a] shadow-xl">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-white/5"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const parts = compose.to.split(",").map((p) => p.trim()).filter(Boolean);
                      parts[parts.length - 1] = s;
                      setCompose((c) => ({ ...c, to: parts.join(", ") }));
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {showCc ? (
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs text-zinc-500">Cc</span>
              <input
                value={compose.cc}
                onChange={(e) => setCompose((c) => ({ ...c, cc: e.target.value }))}
                className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/6"
              />
            </div>
          ) : null}
          {showBcc ? (
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs text-zinc-500">Bcc</span>
              <input
                value={compose.bcc}
                onChange={(e) => setCompose((c) => ({ ...c, bcc: e.target.value }))}
                className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/6"
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-zinc-500">Subj</span>
            <input
              value={compose.subject}
              onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
              className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/6"
            />
          </div>
          <datalist id="orbit-recipients">
            {recentRecipients.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </div>

        <div className="flex items-center gap-1 border-b border-white/10 px-3 py-1.5">
          {[
            { label: "Bold", icon: Bold, fn: () => exec("bold") },
            { label: "Italic", icon: Italic, fn: () => exec("italic") },
            { label: "List", icon: List, fn: () => exec("insertUnorderedList") },
            { label: "Link", icon: Link2, fn: insertLink },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.fn}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-[#f0d78c]"
            >
              <t.icon className="size-3.5" />
            </button>
          ))}
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          aria-label="Message body"
          onInput={syncFromEditor}
          onBlur={syncFromEditor}
          className="orbit-scroll min-h-0 flex-1 overflow-y-auto bg-transparent px-4 py-3 text-sm outline-none empty:before:pointer-events-none empty:before:text-zinc-600 empty:before:content-['Write_your_message…']"
        />

        {compose.attachments.length > 0 ? (
          <div className="space-y-2 border-t border-white/10 px-4 py-3">
            {compose.attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#14141e] px-3 py-2 text-sm"
              >
                {a.contentType.startsWith("image/") ? (
                  <ImageIcon className="size-4 text-[#d4af37]" />
                ) : (
                  <FileText className="size-4 text-[#d4af37]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.filename}</p>
                  <p className="text-xs text-zinc-500">
                    {(a.size / 1024).toFixed(1)} KB
                    {a.progress < 100 ? ` · uploading ${a.progress}%` : ""}
                  </p>
                  {a.progress < 100 ? (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-[#d4af37]" style={{ width: `${a.progress}%` }} />
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-zinc-400 hover:bg-white/5 hover:text-white"
                  onClick={() =>
                    setCompose((c) => ({ ...c, attachments: c.attachments.filter((x) => x.id !== a.id) }))
                  }
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              <Paperclip className="size-3.5" />
              Attach
            </button>
            <button
              type="button"
              onClick={() => void saveDraft(false)}
              disabled={draftSaving}
              className="text-sm text-zinc-400 hover:text-white disabled:opacity-50"
            >
              {draftSaving ? "Saving…" : "Save draft"}
            </button>
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={() => void send()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] px-5 py-2 text-sm font-bold text-[#1a1200] disabled:opacity-60"
          >
            <Send className="size-3.5" />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>

        {!mobile ? (
          <div
            className="absolute bottom-1 right-1 size-4 cursor-se-resize rounded-sm border border-white/20 bg-white/10"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            aria-hidden
          />
        ) : null}
      </motion.div>
    </motion.div>
  );
}
