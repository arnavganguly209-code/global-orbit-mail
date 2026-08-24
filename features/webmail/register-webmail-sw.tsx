"use client";

import * as React from "react";

/** Registers the webmail service worker once on the client. */
export function RegisterWebmailSw() {
  React.useEffect(() => {
    const path = window.location.pathname;
    const mailboxUi =
      path.startsWith("/mail") ||
      path.startsWith("/compose") ||
      path.startsWith("/settings") ||
      path.startsWith("/profile") ||
      path.startsWith("/contacts");
    if (!mailboxUi) return;
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    const prevScheme = root.style.colorScheme;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      if (hadDark) root.classList.add("dark");
      root.style.colorScheme = prevScheme;
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const host = window.location.hostname;
    // Only on production webmail / apex hosts — skip localhost noise
    const allow =
      host.includes("globalorbitmail") ||
      host === "localhost" ||
      host === "127.0.0.1";
    if (!allow) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
