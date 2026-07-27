"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ArrowLeft, Camera, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, webmailApi, type Me, type MeBranding } from "@/features/webmail/lib/api";
import { webmailRoutes } from "@/config/webmail-routes";

type Prefs = { theme: "dark" | "light" | "system"; signature: string };

type ProfileForm = {
  displayName: string;
  jobTitle: string;
  company: string;
  phone: string;
  website: string;
  address: string;
  replyTo: string;
  timezone: string;
  language: string;
  signatureHtml: string;
  signatureText: string;
  avatarUrl: string;
};

function brandingToForm(b: MeBranding | null | undefined, name: string): ProfileForm {
  return {
    displayName: b?.displayName || name || "",
    jobTitle: b?.jobTitle || "",
    company: b?.company || b?.domainCompanyName || "",
    phone: b?.phone || "",
    website: b?.website || "",
    address: "",
    replyTo: b?.replyTo || "",
    timezone: b?.timezone || "",
    language: b?.language || "",
    signatureHtml: b?.signatureHtml || "",
    signatureText: b?.signatureText || "",
    avatarUrl: b?.avatarUrl || "",
  };
}

function buildPreviewHtml(profile: ProfileForm, logo: string | null, email: string) {
  if (profile.signatureHtml.trim()) {
    const custom = profile.signatureHtml.trim();
    if (logo && !/<img[\s>]/i.test(custom)) {
      return `${`<img src="${logo}" alt="" style="max-height:48px;margin-bottom:10px;display:block" />`}${custom}`;
    }
    return custom;
  }
  const parts = [
    logo
      ? `<img src="${logo}" alt="" style="max-height:48px;margin-bottom:10px;display:block" />`
      : "",
    `<strong>${profile.displayName || "Your name"}</strong>`,
    profile.jobTitle ? `<div>${profile.jobTitle}</div>` : "",
    profile.company ? `<div style="font-weight:600">${profile.company}</div>` : "",
    profile.phone ? `<div>${profile.phone}</div>` : "",
    profile.website
      ? `<div><a href="${profile.website}" style="color:#8a6d1a">${profile.website}</a></div>`
      : "",
    `<div><a href="mailto:${email}" style="color:#8a6d1a">${email}</a></div>`,
    profile.signatureText
      ? `<div style="margin-top:8px;white-space:pre-wrap">${profile.signatureText}</div>`
      : "",
  ];
  return parts.filter(Boolean).join("");
}

export function WebmailSettingsPage() {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";
  const [prefs, setPrefs] = React.useState<Prefs>({ theme: "dark", signature: "" });
  const [profile, setProfile] = React.useState<ProfileForm>(brandingToForm(null, ""));
  const [email, setEmail] = React.useState("");
  const [domainLogo, setDomainLogo] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

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
        setDomainLogo(me.branding?.domainLogoDataUrl || null);
        setPrefs(settings);
        setTheme(settings.theme);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load profile");
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
            avatarUrl: profile.avatarUrl || null,
          }),
        }),
        webmailApi<Prefs>("/api/webmail/settings", {
          method: "PUT",
          body: JSON.stringify({ theme: prefs.theme, signature: profile.signatureText }),
        }),
      ]);
      setProfile(brandingToForm(branding, branding.displayName));
      setDomainLogo(branding.domainLogoDataUrl || null);
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

  function onAvatar(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Photo must be an image");
      return;
    }
    if (file.size > 512_000) {
      toast.error("Photo must be under 512KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setProfile((p) => ({ ...p, avatarUrl: result }));
    };
    reader.readAsDataURL(file);
  }

  function applyBrandedSignature() {
    const html = buildPreviewHtml(
      { ...profile, signatureHtml: "" },
      domainLogo,
      email,
    );
    setProfile((p) => ({ ...p, signatureHtml: html }));
    toast.success("Professional signature applied — save to keep");
  }

  function field(
    key: keyof ProfileForm,
    label: string,
    opts?: { multiline?: boolean; rows?: number; placeholder?: string },
  ) {
    const common = {
      value: profile[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setProfile((p) => ({ ...p, [key]: e.target.value })),
      className: cn(
        "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-[#d4af37]/70",
        light
          ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
          : "border-white/10 bg-[#12121a] text-white placeholder:text-zinc-500",
      ),
      placeholder: opts?.placeholder,
    };
    return (
      <label className="mb-4 block text-sm">
        <span className={cn("mb-1.5 block font-medium", light ? "text-slate-600" : "text-zinc-400")}>
          {label}
        </span>
        {opts?.multiline ? (
          <textarea {...common} rows={opts.rows ?? 5} />
        ) : (
          <input {...common} className={`${common.className} h-11`} />
        )}
      </label>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          "mx-auto flex min-h-dvh max-w-3xl items-center justify-center px-4 text-sm",
          light ? "bg-[#eef1f6] text-slate-500" : "bg-[#050508] text-zinc-500",
        )}
      >
        Loading profile…
      </div>
    );
  }

  const preview = buildPreviewHtml(profile, domainLogo, email);

  return (
    <div
      className={cn(
        "min-h-dvh px-4 py-8 sm:px-6",
        light ? "bg-[#eef1f6] text-slate-900" : "bg-[#050508] text-[#f5f5f7]",
      )}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href={webmailRoutes.mail}
            className={cn(
              "inline-flex items-center gap-2 text-sm font-medium",
              light ? "text-slate-600 hover:text-slate-900" : "text-zinc-400 hover:text-white",
            )}
          >
            <ArrowLeft className="size-4" />
            Back to mail
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              "inline-flex items-center gap-2 text-sm",
              light ? "text-slate-600 hover:text-slate-900" : "text-zinc-400 hover:text-white",
            )}
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </div>

        <div
          className={cn(
            "mb-6 overflow-hidden rounded-2xl border p-6 shadow-xl sm:p-8",
            light ? "border-slate-200 bg-white" : "border-white/10 bg-[#0b0b11]",
          )}
        >
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#d4af37]/40 to-[#1e5fa1]/40 text-xl font-bold"
              title="Upload photo"
            >
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                initials(profile.displayName || email)
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                <Camera className="size-5 text-white" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onAvatar(e.target.files?.[0] ?? null)}
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mail Profile</h1>
              <p className={cn("mt-1 truncate text-sm", light ? "text-slate-500" : "text-zinc-500")}>
                {email}
              </p>
              {domainLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={domainLogo} alt="Company logo" className="mt-3 h-8 w-auto object-contain" />
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "rounded-2xl border p-6 shadow-lg sm:p-8",
            light ? "border-slate-200 bg-white" : "border-white/10 bg-[#0b0b11]",
          )}
        >
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[#d4af37]">
            Profile
          </h2>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {field("displayName", "Display name")}
            {field("jobTitle", "Job title")}
            {field("company", "Company name")}
            {field("phone", "Phone")}
            {field("website", "Website", { placeholder: "https://" })}
            {field("replyTo", "Reply-To email")}
            {field("timezone", "Timezone", { placeholder: "Asia/Kathmandu" })}
            {field("language", "Language", { placeholder: "en" })}
          </div>

          <h2 className="mb-3 mt-2 text-xs font-bold uppercase tracking-[0.14em] text-[#d4af37]">
            Email signature
          </h2>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyBrandedSignature}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-1.5 text-xs font-semibold text-[#f0d78c] hover:bg-[#d4af37]/20"
            >
              <Sparkles className="size-3.5" />
              Apply professional branding
            </button>
          </div>
          {field("signatureText", "Signature (plain text)", { multiline: true, rows: 3 })}
          {field("signatureHtml", "Signature (HTML)", { multiline: true, rows: 6 })}

          <div
            className={cn(
              "mb-6 rounded-xl border p-4",
              light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#12121a]",
            )}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#d4af37]">
              Signature preview
            </p>
            <div
              className={cn("prose max-w-none text-sm", light ? "prose-slate" : "prose-invert")}
              dangerouslySetInnerHTML={{ __html: preview || "<p>No signature yet</p>" }}
            />
          </div>

          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#d4af37]">
            Appearance
          </h2>
          <label className="mb-6 block text-sm">
            <span className={cn("mb-1.5 block font-medium", light ? "text-slate-600" : "text-zinc-400")}>
              Theme
            </span>
            <select
              value={prefs.theme}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, theme: e.target.value as Prefs["theme"] }))
              }
              className={cn(
                "h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#d4af37]/70",
                light
                  ? "border-slate-200 bg-white text-slate-900"
                  : "border-white/10 bg-[#12121a] text-white",
              )}
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
            className="rounded-full bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] px-6 py-3 text-sm font-bold text-[#1a1200] shadow-[0_10px_30px_rgba(212,175,55,0.25)] transition hover:brightness-105 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>

        <div className="mt-6 flex justify-center opacity-80">
          <Image
            src="/brand/logo.png"
            alt="GLOBAL ORBIT"
            width={180}
            height={48}
            className="h-10 w-auto object-contain"
          />
        </div>
      </div>
    </div>
  );
}
