"use client";

import * as React from "react";
import Image from "next/image";
import { Download, Share, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "orbit-pwa-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Mobile “Install app” banner — Chrome/Edge beforeinstallprompt + iOS Add to Home Screen tip.
 */
export function PwaInstallBanner({ className }: { className?: string }) {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [iosHint, setIosHint] = React.useState(false);

  React.useEffect(() => {
    if (isStandalone()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
      setIosHint(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if (window.matchMedia("(max-width: 900px)").matches) {
      if (isIos()) {
        setIosHint(true);
        setVisible(true);
      } else {
        const t = window.setTimeout(() => setVisible(true), 1600);
        return () => {
          window.clearTimeout(t);
          window.removeEventListener("beforeinstallprompt", onBip);
        };
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") setVisible(false);
  }

  if (!visible || isStandalone()) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto fixed inset-x-3 z-[60] rounded-2xl border border-[#d4af37]/35 bg-[#0b0b11]/95 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
      role="dialog"
      aria-label="Install Global Orbit Mail"
    >
      <div className="flex items-start gap-3">
        <Image
          src="/brand/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-xl ring-1 ring-[#d4af37]/40"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Install Orbit Mail</p>
          <p className="mt-0.5 text-[0.72rem] leading-snug text-white/65">
            {iosHint
              ? "Tap Share, then Add to Home Screen for a full-screen app experience."
              : "Add to your home screen — opens like a native mail app."}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {deferred ? (
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] px-3.5 text-xs font-bold text-[#1a1200]"
              >
                <Download className="size-3.5" />
                Install app
              </button>
            ) : iosHint ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold text-[#e0bc4a]">
                <Share className="size-3.5" />
                Share → Add to Home Screen
              </span>
            ) : (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold text-white/70">
                Use browser menu → Install app
              </span>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-9 items-center rounded-full px-3 text-xs font-medium text-white/55 hover:text-white"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1.5 text-white/45 hover:bg-white/5 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
