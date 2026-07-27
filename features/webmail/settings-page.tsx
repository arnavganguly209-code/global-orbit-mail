"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ArrowLeft, LogOut } from "lucide-react";
import { webmailApi, type Me, type MeBranding } from "@/features/webmail/lib/api";
import { webmailRoutes } from "@/config/webmail-routes";

type Prefs = { theme: "dark" | "light" | "system"; signature: string };

type ProfileForm = {
  displayName: string;
  jobTitle: string;
  company: string;
  phone: string;
  website: string;
  replyTo: string;
  timezone: string;
  language: string;
  signatureHtml: string;
  signatureText: string;
};

function brandingToForm(b: MeBranding | null | undefined, name: string): ProfileForm {
  return {
    displayName: b?.displayName || name || "",
    jobTitle: b?.jobTitle || "",
    company: b?.company || "",
    phone: b?.phone || "",
    website: b?.website || "",
    replyTo: b?.replyTo || "",
    timezone: b?.timezone || "",
    language: b?.language || "",
    signatureHtml: b?.signatureHtml || "",
    signatureText: b?.signatureText || "",
  };
}

export function WebmailSettingsPage() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [prefs, setPrefs] = React.useState<Prefs>({ theme: "dark", signature: "" });
  const [profile, setProfile] = React.useState<ProfileForm>(brandingToForm(null, ""));
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, settings] = await Promise.all([
          webmailApi<Me>("/api/webmail/auth/me"),
          webmailApi<Prefs>("/api/webmail/settings"),
        ]);
        if (cancelled) return;
        setEmail(me.email);
        setProfile(brandingToForm(me.branding, me.name));
        setPrefs(settings);
        setTheme(settings.theme);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
        router.replace(webmailRoutes.home);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router, setTheme]);

  async function save() {
    setSaving(true);
    try {
      const [branding] = await Promise.all([
        webmailApi<MeBranding>("/api/webmail/profile", {
          method: "PUT",
          body: JSON.stringify({
            displayName: profile.displayName || null,
            jobTitle: profile.jobTitle || null,
            company: profile.company || null,
            phone: profile.phone || null,
            website: profile.website || null,
            replyTo: profile.replyTo || null,
            timezone: profile.timezone || null,
            language: profile.language || null,
            signatureHtml: profile.signatureHtml || null,
            signatureText: profile.signatureText || null,
          }),
        }),
        webmailApi<Prefs>("/api/webmail/settings", {
          method: "PUT",
          body: JSON.stringify({ theme: prefs.theme, signature: profile.signatureText }),
        }),
      ]);
      setProfile(brandingToForm(branding, branding.displayName));
      setTheme(prefs.theme);
      toast.success("Profile saved");
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

  function field(
    key: keyof ProfileForm,
    label: string,
    opts?: { multiline?: boolean; rows?: number; placeholder?: string },
  ) {
    const common = {
      value: profile[key],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setProfile((p) => ({ ...p, [key]: e.target.value })),
      className: "w-full rounded-lg border border-white/10 bg-[#12121a] px-3 py-2 text-sm",
      placeholder: opts?.placeholder,
    };
    return (
      <label className="mb-4 block text-sm">
        <span className="mb-1.5 block text-zinc-400">{label}</span>
        {opts?.multiline ? (
          <textarea {...common} rows={opts.rows ?? 5} />
        ) : (
          <input {...common} className={`${common.className} h-10`} />
        )}
      </label>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl items-center justify-center px-4 text-sm text-zinc-500">
        Loading settings…
      </div>
    );
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

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mb-6 truncate text-sm text-zinc-500">{email}</p>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#d4af37]">
        Profile
      </h2>
      {field("displayName", "Display name")}
      {field("jobTitle", "Job title")}
      {field("company", "Company")}
      {field("phone", "Phone")}
      {field("website", "Website", { placeholder: "https://" })}
      {field("replyTo", "Reply-To email")}
      {field("timezone", "Timezone", { placeholder: "Asia/Kathmandu" })}
      {field("language", "Language", { placeholder: "en" })}
      {field("signatureText", "Signature (plain text)", { multiline: true, rows: 4 })}
      {field("signatureHtml", "Signature (HTML)", { multiline: true, rows: 6 })}

      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-[#d4af37]">
        Appearance
      </h2>
      <label className="mb-6 block text-sm">
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
