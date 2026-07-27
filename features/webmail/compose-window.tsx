"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Link as TiptapLink } from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Paperclip,
  Palette,
  Send,
  Smile,
  Table as TableIcon,
  Underline as UnderlineIcon,
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

const TEXT_COLORS = [
  "#f7f8fb",
  "#f0d78c",
  "#d4af37",
  "#86efac",
  "#93c5fd",
  "#f9a8d4",
  "#fca5a5",
  "#a1a1aa",
];

const HIGHLIGHT_COLORS = [
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#fbcfe8",
  "#fed7aa",
  "#d4d4d8",
];

const COMMON_EMOJIS = [
  "😀",
  "😊",
  "👍",
  "🙏",
  "❤️",
  "🎉",
  "✅",
  "⭐",
  "🔥",
  "💡",
  "📎",
  "📧",
  "🚀",
  "⚡",
  "👋",
  "😅",
  "🤝",
  "💯",
  "✨",
  "📅",
  "⏰",
  "🎯",
  "📌",
  "💬",
];

const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
  }),
  Underline,
  TiptapLink.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { class: "orbit-compose-link" },
  }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Placeholder.configure({ placeholder: "Write your message…" }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
];

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

function normalizeComposeContent(state: Pick<ComposeState, "body" | "html">) {
  const text = state.body.trim() || htmlToPlain(state.html || "").trim();
  return text;
}

function attachmentsMatch(a: ComposeAttachment[], b: ComposeAttachment[]) {
  if (a.length !== b.length) return false;
  return a.every((item, i) => {
    const other = b[i];
    return (
      item.filename === other.filename &&
      item.size === other.size &&
      item.contentType === other.contentType
    );
  });
}

function toolbarBtn(active?: boolean) {
  return cn(
    "rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-[#f0d78c]",
    active && "bg-[#d4af37]/15 text-[#f0d78c]",
  );
}

function ComposeToolbar({
  editor,
  onInsertLink,
  onInsertTable,
  colorOpen,
  setColorOpen,
  highlightOpen,
  setHighlightOpen,
  emojiOpen,
  setEmojiOpen,
  onInsertEmoji,
}: {
  editor: Editor | null;
  onInsertLink: () => void;
  onInsertTable: () => void;
  colorOpen: boolean;
  setColorOpen: (v: boolean) => void;
  highlightOpen: boolean;
  setHighlightOpen: (v: boolean) => void;
  emojiOpen: boolean;
  setEmojiOpen: (v: boolean) => void;
  onInsertEmoji: (emoji: string) => void;
}) {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!editor) return;
    const bump = () => setTick((t) => t + 1);
    editor.on("selectionUpdate", bump);
    editor.on("transaction", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("transaction", bump);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-white/10 px-3 py-1.5"
      data-orbit-compose-popover
    >
      <button
        type="button"
        title="Bold"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={toolbarBtn(editor.isActive("bold"))}
      >
        <Bold className="size-3.5" />
      </button>
      <button
        type="button"
        title="Italic"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={toolbarBtn(editor.isActive("italic"))}
      >
        <Italic className="size-3.5" />
      </button>
      <button
        type="button"
        title="Underline"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={toolbarBtn(editor.isActive("underline"))}
      >
        <UnderlineIcon className="size-3.5" />
      </button>

      <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />

      <button
        type="button"
        title="Bullet list"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={toolbarBtn(editor.isActive("bulletList"))}
      >
        <List className="size-3.5" />
      </button>
      <button
        type="button"
        title="Numbered list"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={toolbarBtn(editor.isActive("orderedList"))}
      >
        <ListOrdered className="size-3.5" />
      </button>

      <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />

      <button
        type="button"
        title="Link"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onInsertLink}
        className={toolbarBtn(editor.isActive("link"))}
      >
        <Link2 className="size-3.5" />
      </button>

      <div className="relative">
        <button
          type="button"
          title="Text color"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setHighlightOpen(false);
            setEmojiOpen(false);
            setColorOpen(!colorOpen);
          }}
          className={toolbarBtn(colorOpen)}
        >
          <Palette className="size-3.5" />
        </button>
        {colorOpen ? (
          <div
            data-orbit-compose-popover
            className="absolute left-0 top-9 z-20 flex gap-1 rounded-lg border border-white/10 bg-[#12121a] p-2 shadow-xl"
          >
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                className="size-5 rounded border border-white/20"
                style={{ backgroundColor: color }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setColor(color).run();
                  setColorOpen(false);
                }}
              />
            ))}
            <button
              type="button"
              title="Clear color"
              className="rounded px-1.5 text-[10px] text-zinc-400 hover:text-white"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setColorOpen(false);
              }}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          title="Highlight"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setColorOpen(false);
            setEmojiOpen(false);
            setHighlightOpen(!highlightOpen);
          }}
          className={toolbarBtn(highlightOpen || editor.isActive("highlight"))}
        >
          <Highlighter className="size-3.5" />
        </button>
        {highlightOpen ? (
          <div
            data-orbit-compose-popover
            className="absolute left-0 top-9 z-20 flex gap-1 rounded-lg border border-white/10 bg-[#12121a] p-2 shadow-xl"
          >
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                className="size-5 rounded border border-white/20"
                style={{ backgroundColor: color }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color }).run();
                  setHighlightOpen(false);
                }}
              />
            ))}
            <button
              type="button"
              title="Clear highlight"
              className="rounded px-1.5 text-[10px] text-zinc-400 hover:text-white"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setHighlightOpen(false);
              }}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />

      <button
        type="button"
        title="Insert table"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onInsertTable}
        className={toolbarBtn(editor.isActive("table"))}
      >
        <TableIcon className="size-3.5" />
      </button>

      <button
        type="button"
        title="Align left"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={toolbarBtn(editor.isActive({ textAlign: "left" }))}
      >
        <AlignLeft className="size-3.5" />
      </button>
      <button
        type="button"
        title="Align center"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={toolbarBtn(editor.isActive({ textAlign: "center" }))}
      >
        <AlignCenter className="size-3.5" />
      </button>
      <button
        type="button"
        title="Align right"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={toolbarBtn(editor.isActive({ textAlign: "right" }))}
      >
        <AlignRight className="size-3.5" />
      </button>
      <button
        type="button"
        title="Justify"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        className={toolbarBtn(editor.isActive({ textAlign: "justify" }))}
      >
        <AlignJustify className="size-3.5" />
      </button>

      <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />

      <div className="relative">
        <button
          type="button"
          title="Insert emoji"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setColorOpen(false);
            setHighlightOpen(false);
            setEmojiOpen(!emojiOpen);
          }}
          className={toolbarBtn(emojiOpen)}
        >
          <Smile className="size-3.5" />
        </button>
        {emojiOpen ? (
          <div
            data-orbit-compose-popover
            className="absolute right-0 top-9 z-20 grid w-48 grid-cols-6 gap-1 rounded-lg border border-white/10 bg-[#12121a] p-2 shadow-xl"
          >
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="rounded p-1 text-base hover:bg-white/10"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
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
  const [draftSavedAt, setDraftSavedAt] = React.useState<number | null>(null);
  const [toFocus, setToFocus] = React.useState(false);
  const [clientSignature, setClientSignature] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [size, setSize] = React.useState({ w: 672, h: 640 });
  const [minimized, setMinimized] = React.useState(false);
  const [maximized, setMaximized] = React.useState(false);
  const [colorOpen, setColorOpen] = React.useState(false);
  const [highlightOpen, setHighlightOpen] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const resizeRef = React.useRef<{ ox: number; oy: number; w: number; h: number } | null>(null);
  const baselineRef = React.useRef<ComposeState | null>(null);
  const composeRef = React.useRef(compose);

  React.useEffect(() => {
    composeRef.current = compose;
  }, [compose]);

  const syncFromEditor = React.useCallback((editor: Editor | null) => {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText().replace(/\u00a0/g, " ").trimEnd();
    setCompose((c) => ({ ...c, html, body: text }));
    composeRef.current = { ...composeRef.current, html, body: text };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    content: "",
    editable: open,
    editorProps: {
      attributes: {
        class:
          "orbit-compose-editor min-h-[120px] outline-none focus:outline-none text-sm text-zinc-100",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Message body",
      },
    },
    onUpdate: ({ editor: ed }) => syncFromEditor(ed),
    onBlur: ({ editor: ed }) => syncFromEditor(ed),
  });

  React.useEffect(() => {
    if (!open) return;
    setPos({ x: 0, y: 0 });
    setSize({ w: Math.min(672, typeof window !== "undefined" ? window.innerWidth - 32 : 672), h: 640 });
    setMinimized(false);
    setMaximized(false);
    setDraftSavedAt(null);
    setColorOpen(false);
    setHighlightOpen(false);
    setEmojiOpen(false);

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

    const next = { ...initial, body, html };
    setCompose(next);
    composeRef.current = next;
    baselineRef.current = {
      ...next,
      attachments: initial.attachments.map((a) => ({ ...a })),
    };
    setClientSignature(usedSig);
    setShowCc(Boolean(initial.cc));
    setShowBcc(Boolean(initial.bcc));

    if (editor) {
      editor.setEditable(true);
      editor.commands.setContent(html || (body ? textToHtml(body) : "<p></p>"));
    }
  }, [open, initial, signatureHtml, signatureText, editor]);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      syncFromEditor(editor);
      const c = composeRef.current;
      if (!c.to && !c.subject && !normalizeComposeContent(c) && c.attachments.length === 0) return;
      void saveDraft(true);
    }, 45_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editor]);

  React.useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("[data-orbit-compose-popover]")) return;
      setColorOpen(false);
      setHighlightOpen(false);
      setEmojiOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  const suggestions = React.useMemo(() => {
    const q = compose.to.split(",").pop()?.trim().toLowerCase() || "";
    if (!q || q.length < 1) return [];
    return recentRecipients.filter((e) => e.includes(q)).slice(0, 6);
  }, [compose.to, recentRecipients]);

  function insertLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      syncFromEditor(editor);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    syncFromEditor(editor);
  }

  function insertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    syncFromEditor(editor);
  }

  function insertEmoji(emoji: string) {
    editor?.chain().focus().insertContent(emoji).run();
    setEmojiOpen(false);
    syncFromEditor(editor);
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
    syncFromEditor(editor);
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
      setDraftSavedAt(Date.now());
      if (!silent) toast.success("Draft saved");
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDraftSaving(false);
    }
  }

  async function send() {
    syncFromEditor(editor);
    const c = composeRef.current;
    if (!c.to.trim()) {
      toast.error("Add at least one To recipient");
      return;
    }
    if (!normalizeComposeContent(c) && c.attachments.length === 0) {
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

  function hasUnsavedChanges() {
    syncFromEditor(editor);
    const c = composeRef.current;
    const b = baselineRef.current;
    if (!b) return false;
    if (c.to.trim() !== b.to.trim()) return true;
    if (c.cc.trim() !== b.cc.trim()) return true;
    if (c.bcc.trim() !== b.bcc.trim()) return true;
    if (c.subject.trim() !== b.subject.trim()) return true;
    if (normalizeComposeContent(c) !== normalizeComposeContent(b)) return true;
    if (!attachmentsMatch(c.attachments, b.attachments)) return true;
    return false;
  }

  function requestClose() {
    if (hasUnsavedChanges()) {
      const ok = window.confirm("Discard this message? Unsaved changes will be lost.");
      if (!ok) return;
    }
    onClose();
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

  const draftIndicator = draftSaving
    ? "Saving draft…"
    : draftSavedAt
      ? `Draft saved · ${new Date(draftSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : null;

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
        if (e.target === e.currentTarget) requestClose();
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
            : minimized
              ? {
                  width: 320,
                  height: 48,
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  maxWidth: "96vw",
                }
              : maximized
                ? {
                    width: typeof window !== "undefined" ? window.innerWidth - 24 : 1200,
                    height: typeof window !== "undefined" ? window.innerHeight - 24 : 800,
                    transform: "translate(0px, 0px)",
                    maxWidth: "100vw",
                    maxHeight: "100vh",
                  }
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
          !mobile && minimized && "fixed bottom-4 right-4 z-50",
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
          <div className="flex items-center gap-0.5">
            {!mobile ? (
              <>
                <button
                  type="button"
                  title={minimized ? "Restore" : "Minimize"}
                  onClick={() => {
                    setMinimized((v) => !v);
                    if (!minimized) setMaximized(false);
                  }}
                  className="rounded-lg p-1 hover:bg-white/5"
                >
                  <Minimize2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  title={maximized ? "Restore" : "Maximize"}
                  onClick={() => {
                    setMaximized((v) => !v);
                    setMinimized(false);
                  }}
                  className="rounded-lg p-1 hover:bg-white/5"
                >
                  <Maximize2 className="size-3.5" />
                </button>
              </>
            ) : null}
            <button type="button" onClick={requestClose} className="rounded-lg p-1 hover:bg-white/5">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {minimized && !mobile ? null : (
        <>
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
              className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/60"
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
                className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/60"
              />
            </div>
          ) : null}
          {showBcc ? (
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs text-zinc-500">Bcc</span>
              <input
                value={compose.bcc}
                onChange={(e) => setCompose((c) => ({ ...c, bcc: e.target.value }))}
                className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/60"
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-zinc-500">Subj</span>
            <input
              value={compose.subject}
              onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
              className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-[#d4af37]/60"
            />
          </div>
          <datalist id="orbit-recipients">
            {recentRecipients.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </div>

        <ComposeToolbar
          editor={editor}
          onInsertLink={insertLink}
          onInsertTable={insertTable}
          colorOpen={colorOpen}
          setColorOpen={setColorOpen}
          highlightOpen={highlightOpen}
          setHighlightOpen={setHighlightOpen}
          emojiOpen={emojiOpen}
          setEmojiOpen={setEmojiOpen}
          onInsertEmoji={insertEmoji}
        />

        <div
          className="orbit-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3 [&_.orbit-compose-editor_a]:text-[#f0d78c] [&_.orbit-compose-editor_a]:underline [&_.orbit-compose-editor_ol]:list-decimal [&_.orbit-compose-editor_ol]:pl-5 [&_.orbit-compose-editor_p.is-editor-empty:first-child::before]:pointer-events-none [&_.orbit-compose-editor_p.is-editor-empty:first-child::before]:float-left [&_.orbit-compose-editor_p.is-editor-empty:first-child::before]:h-0 [&_.orbit-compose-editor_p.is-editor-empty:first-child::before]:text-zinc-600 [&_.orbit-compose-editor_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.orbit-compose-editor_table]:w-full [&_.orbit-compose-editor_table]:border-collapse [&_.orbit-compose-editor_td]:border [&_.orbit-compose-editor_td]:border-white/20 [&_.orbit-compose-editor_td]:p-2 [&_.orbit-compose-editor_th]:border [&_.orbit-compose-editor_th]:border-white/20 [&_.orbit-compose-editor_th]:bg-white/5 [&_.orbit-compose-editor_th]:p-2 [&_.orbit-compose-editor_ul]:list-disc [&_.orbit-compose-editor_ul]:pl-5"
          data-orbit-compose-popover
        >
          <EditorContent editor={editor} />
        </div>

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
          <div className="flex min-w-0 flex-1 items-center gap-2">
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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              <Paperclip className="size-3.5" />
              Attach
            </button>
            <button
              type="button"
              onClick={() => void saveDraft(false)}
              disabled={draftSaving}
              className="shrink-0 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
            >
              Save draft
            </button>
            {draftIndicator ? (
              <span
                className={cn(
                  "truncate text-xs",
                  draftSaving ? "text-[#f0d78c]" : "text-zinc-500",
                )}
                aria-live="polite"
              >
                {draftIndicator}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={() => void send()}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] px-5 py-2 text-sm font-bold text-[#1a1200] disabled:opacity-60"
          >
            <Send className="size-3.5" />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>

        {!mobile && !minimized && !maximized ? (
          <div
            className="absolute bottom-1 right-1 size-4 cursor-se-resize rounded-sm border border-white/20 bg-white/10"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            aria-hidden
          />
        ) : null}
        </>
        )}
      </motion.div>
    </motion.div>
  );
}
