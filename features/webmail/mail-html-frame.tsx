"use client";

import * as React from "react";

function parseCssColor(value: string): [number, number, number, number] | null {
  if (!value || value === "transparent" || value === "none") return null;
  const rgba = value.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
  );
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] == null ? 1 : Number(rgba[4])];
  }
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return null;
  let h = hex[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
}

function srgbLum([r, g, b]: [number, number, number]) {
  const lin = [r, g, b].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]) {
  const a = srgbLum(fg) + 0.05;
  const b = srgbLum(bg) + 0.05;
  return a > b ? a / b : b / a;
}

function effectiveBackground(el: HTMLElement): [number, number, number] {
  let node: HTMLElement | null = el;
  while (node) {
    const parsed = parseCssColor(node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor || "");
    if (parsed && parsed[3] > 0.12) return [parsed[0], parsed[1], parsed[2]];
    node = node.parentElement;
  }
  return [255, 255, 255];
}

function hasDirectText(el: Element) {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim()) return true;
  }
  return false;
}

/** Fix only unreadable fg/bg pairs. Leave branded high-contrast colors alone. */
function repairLowContrast(doc: Document) {
  const skip = new Set(["SCRIPT", "STYLE", "IMG", "SVG", "VIDEO", "BR", "HR", "PATH"]);
  const nodes = doc.body.querySelectorAll("*");
  for (const el of nodes) {
    if (skip.has(el.tagName) || !hasDirectText(el)) continue;
    const htmlEl = el as HTMLElement;
    const cs = doc.defaultView?.getComputedStyle(htmlEl);
    if (!cs) continue;
    const fg = parseCssColor(cs.color);
    if (!fg || fg[3] < 0.2) continue;
    const bg = effectiveBackground(htmlEl);
    if (contrastRatio([fg[0], fg[1], fg[2]], bg) >= 3.2) continue;
    htmlEl.style.setProperty("color", srgbLum(bg) > 0.42 ? "#1a1a1a" : "#f4f4f5", "important");
  }
  for (const link of doc.body.querySelectorAll("a")) {
    const htmlEl = link as HTMLElement;
    const cs = doc.defaultView?.getComputedStyle(htmlEl);
    if (!cs) continue;
    const fg = parseCssColor(cs.color);
    if (!fg) continue;
    const bg = effectiveBackground(htmlEl);
    if (contrastRatio([fg[0], fg[1], fg[2]], bg) >= 3.2) continue;
    htmlEl.style.setProperty("color", srgbLum(bg) > 0.42 ? "#1558d6" : "#8ab4f8", "important");
  }
}

function buildMailSrcDoc(html: string) {
  const safe = html.replace(/<\/iframe/gi, "<\\/iframe");
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<base target="_blank" rel="noopener noreferrer"/>
<style>
  :root { color-scheme: light; }
  html {
    margin: 0;
    background: #ffffff;
    color-scheme: light;
    overflow-x: auto;
    max-width: 100%;
  }
  body {
    margin: 0;
    padding: 8px 8px 24px;
    background: #ffffff;
    color: #202124;
    font: 15px/1.6 ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    overflow-x: auto;
    overflow-y: hidden;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    -webkit-text-size-adjust: 100%;
    max-width: 100%;
  }
  img, video {
    max-width: 100% !important;
    height: auto !important;
    display: inline-block;
    filter: none !important;
    mix-blend-mode: normal !important;
    -webkit-filter: none !important;
  }
  table { max-width: 100% !important; border-collapse: collapse; table-layout: auto; }
  td, th { word-break: break-word; color: inherit; }
  pre, code { white-space: pre-wrap; word-break: break-word; }
  a { color: #1558d6; }
  .orbit-mail-html-root {
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    background: #ffffff;
    color: #202124;
  }
</style>
</head><body><div class="orbit-mail-html-root">${safe}</div></body></html>`;
}

export function MailHtmlFrame({ html }: { html: string }) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = React.useState(180);
  const srcDoc = React.useMemo(() => buildMailSrcDoc(html), [html]);

  const onReady = React.useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    try {
      repairLowContrast(doc);
    } catch {
      /* ignore */
    }
    const next = Math.max(
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      96,
    );
    setHeight(next + 16);
  }, []);

  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const t = window.setTimeout(onReady, 60);
    const t2 = window.setTimeout(onReady, 450);
    iframe.addEventListener("load", onReady);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
      iframe.removeEventListener("load", onReady);
    };
  }, [onReady, srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title="Email message"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={srcDoc}
      onLoad={onReady}
      className="orbit-mail-html-frame block w-full max-w-full rounded-xl border-0 bg-white"
      style={{ height, colorScheme: "light" }}
    />
  );
}
