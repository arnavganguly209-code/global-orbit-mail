"use client";

import * as React from "react";

/** Registers the webmail service worker once on the client. */
export function RegisterWebmailSw() {
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
