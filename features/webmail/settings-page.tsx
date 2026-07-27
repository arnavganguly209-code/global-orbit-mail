"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ArrowLeft, LogOut } from "lucide-react";
import { webmailApi } from "@/features/webmail/lib/api";
import { webmailRoutes } from "@/config/webmail-routes";

type Prefs = { theme: "dark" | "light" | "system"; signature: string };

export function WebmailSettingsPage() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [prefs, setPrefs] = React.useState<Prefs>({ theme: "dark", signature: "" });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void webmailApi<Prefs>("/api/webmail/settings")
      .then((data) => setPrefs(data))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
        router.replace(webmailRoutes.home);
      });
  }, [router]);

  async function save() {
    setSaving(true);
    try {
      const data = await webmailApi<Prefs>("/api/webmail/settings", {
        method: "PUT",
        body: JSON.stringify(prefs),
      });
      setPrefs(data);
      setTheme(data.theme);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/webmail/auth/logout", { method: "POST" });
    router.replace(webmailRoutes.home);
    router.refresh();
  }

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={webmailRoutes.mail}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to mail
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
      <label className="mb-4 block text-sm">
        <span className="mb-1.5 block text-zinc-400">Theme</span>
        <select
          value={prefs.theme}
          onChange={(e) =>
            setPrefs((p) => ({ ...p, theme: e.target.value as Prefs["theme"] }))
          }
          className="h-10 w-full rounded-lg border border-white/10 bg-[#12121a] px-3"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </label>
      <label className="mb-6 block text-sm">
        <span className="mb-1.5 block text-zinc-400">Signature</span>
        <textarea
          value={prefs.signature}
          onChange={(e) => setPrefs((p) => ({ ...p, signature: e.target.value }))}
          rows={6}
          className="w-full rounded-lg border border-white/10 bg-[#12121a] px-3 py-2"
          placeholder="Your email signature…"
        />
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-full bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] px-5 py-2 text-sm font-bold text-[#1a1200] disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
