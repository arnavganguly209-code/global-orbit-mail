"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Paperclip, Send, X, FileText, Image as ImageIcon } from "lucide-react";
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

export function ComposeWindow({
  open,
  initial,
  recentRecipients,
  mobile,
  onClose,
  onSent,
}: {
  open: boolean;
  initial: ComposeState;
  recentRecipients: string[];
  mobile?: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [compose, setCompose] = React.useState(initial);
  const [showCc, setShowCc] = React.useState(Boolean(initial.cc));
  const [showBcc, setShowBcc] = React.useState(Boolean(initial.bcc));
  const [sending, setSending] = React.useState(false);
  const [draftSaving, setDraftSaving] = React.useState(false);
  const [toFocus, setToFocus] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const dropRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setCompose(initial);
    setShowCc(Boolean(initial.cc));
    setShowBcc(Boolean(initial.bcc));
  }, [initial]);

  // Autosave draft every 45s when dirty
  React.useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      if (!compose.to && !compose.subject && !compose.body && compose.attachments.length === 0) return;
      void saveDraft(true);
    }, 45_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, compose.to, compose.cc, compose.bcc, compose.subject, compose.body, compose.attachments]);

  const suggestions = React.useMemo(() => {
    const q = compose.to.split(",").pop()?.trim().toLowerCase() || "";
    if (!q || q.length < 1) return [];
    return recentRecipients.filter((e) => e.includes(q)).slice(0, 6);
  }, [compose.to, recentRecipients]);

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
    setDraftSaving(true);
    try {
      await webmailApi("/api/webmail/messages/draft", {
        method: "POST",
        body: JSON.stringify({
          to: compose.to,
          cc: compose.cc || undefined,
          bcc: compose.bcc || undefined,
          subject: compose.subject,
          text: compose.body,
          inReplyTo: compose.inReplyTo,
          references: compose.references,
          attachments: compose.attachments
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
    if (!compose.to.trim()) {
      toast.error("Add at least one To recipient");
      return;
    }
    if (!compose.body.trim() && compose.attachments.length === 0) {
      toast.error("Message body required");
      return;
    }
    const pending = compose.attachments.some((a) => a.progress < 100 || !a.contentBase64);
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
          to: compose.to,
          cc: compose.cc || undefined,
          bcc: compose.bcc || undefined,
          subject: compose.subject,
          text: compose.body,
          inReplyTo: compose.mode.startsWith("reply") ? compose.inReplyTo : undefined,
          references: compose.references,
          attachments: compose.attachments.map((a) => ({
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

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
      }}
    >
      <motion.div
        ref={dropRef}
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className={cn(
          "flex flex-col overflow-hidden border border-[#d4af37]/25 bg-[#0e0e16] shadow-2xl",
          mobile ? "h-[92dvh] w-full rounded-t-2xl" : "h-[min(720px,92vh)] w-full max-w-2xl rounded-2xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-[#12121a] px-4 py-3">
          <p className="font-semibold">
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

        <textarea
          value={compose.body}
          onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
          className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none"
          placeholder="Write your message… (drop files to attach)"
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
      </motion.div>
    </motion.div>
  );
}
