"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  Eye,
  EyeOff,
  Globe2,
  Lock,
  Mail,
  Moon,
  Shield,
  ShieldCheck,
  Sun,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/features/webmail/hooks/use-layout-mode";
import { webmailRoutes } from "@/config/webmail-routes";

const FEATURES = [
  {
    title: "Secure",
    body: "Enterprise-grade security for your business communications.",
    Icon: ShieldCheck,
  },
  {
    title: "Reliable",
    body: "99.9% uptime and robust infrastructure you can trust.",
    Icon: Mail,
  },
  {
    title: "Fast",
    body: "Lightning fast delivery so your emails are always on time.",
    Icon: Zap,
  },
  {
    title: "Global",
    body: "Access your mail from anywhere in the world.",
    Icon: Globe2,
  },
] as const;

const TRUST = [
  {
    title: "Your Data. Your Control.",
    body: "We never sell your data. Your privacy is our priority.",
    Icon: Lock,
  },
  {
    title: "100% Business Focused",
    body: "Designed exclusively for businesses and professional communication.",
    Icon: Building2,
  },
] as const;

export function OrbitLoginPage() {
  const router = useRouter();
  const layout = useLayoutMode();
  const { resolvedTheme, setTheme } = useTheme();
  const light = resolvedTheme === "light";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [showPass, setShowPass] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [caps, setCaps] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [logoSrc, setLogoSrc] = React.useState("/brand/logo.png");

  React.useEffect(() => {
    // Default dark for this premium surface; user can still toggle light.
    if (resolvedTheme == null) setTheme("dark");
  }, [resolvedTheme, setTheme]);

  React.useEffect(() => {
    const domain = email.includes("@") ? email.split("@")[1] : "";
    if (!domain || domain.length < 3) {
      setLogoSrc("/brand/logo.png");
      return;
    }
    const t = window.setTimeout(() => {
      void fetch(`/api/webmail/branding?domain=${encodeURIComponent(domain)}`)
        .then((r) => r.json())
        .then((json) => {
          if (json?.success && json.data?.loginLogoUrl) {
            setLogoSrc(json.data.loginLogoUrl);
          }
        })
        .catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(t);
  }, [email]);

  if (!layout) {
    return <div className="min-h-dvh bg-[#050508]" aria-hidden />;
  }

  // Mobile stacks; tablet+ use the premium split (scaled) so laptop never scrolls.
  const isCompact = layout === "mobile";
  const splitTight = layout === "tablet" || layout === "laptop";

  function validate() {
    let ok = true;
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required");
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address");
      ok = false;
    } else {
      setEmailError(null);
    }
    if (!password) {
      setPasswordError("Password is required");
      ok = false;
    } else {
      setPasswordError(null);
    }
    return ok;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setPending(true);
    try {
      const res = await fetch("/api/webmail/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, remember }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Sign in failed");
      }
      toast.success("Welcome to Global Orbit Mail");
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : webmailRoutes.mail);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        "orbit-login relative h-dvh max-h-dvh overflow-hidden font-sans antialiased",
        light ? "text-slate-900" : "text-white",
      )}
    >
      <Image
        src="/brand/login-earth.png"
        alt=""
        fill
        priority
        className="object-cover object-[center_35%]"
        sizes="100vw"
      />
      <div
        className={cn(
          "absolute inset-0",
          light
            ? "bg-gradient-to-br from-white/35 via-black/50 to-black/80"
            : "bg-gradient-to-br from-black/55 via-black/70 to-[#050508]/92",
        )}
      />
      {/* Premium gold light wash at bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-[#d4af37]/18 via-[#d4af37]/05 to-transparent"
      />

      <button
        type="button"
        onClick={() => setTheme(light ? "dark" : "light")}
        className={cn(
          "absolute right-3 top-3 z-30 inline-flex size-9 items-center justify-center rounded-full border backdrop-blur-md transition sm:right-4 sm:top-4",
          light
            ? "border-white/50 bg-white/75 text-slate-800 hover:bg-white"
            : "border-white/15 bg-black/45 text-[#f0d78c] hover:bg-black/60",
        )}
        aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      >
        {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </button>

      <div
        className={cn(
          "relative z-10 mx-auto h-dvh max-h-dvh w-full max-w-[1400px] px-4 sm:px-6 lg:px-10",
          isCompact
            ? "flex flex-col gap-0 overflow-y-auto overflow-x-hidden pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
            : cn(
                "grid items-center gap-4 overflow-hidden py-3 lg:gap-8 lg:py-5",
                splitTight
                  ? "grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"
                  : "grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)]",
              ),
        )}
      >
        {/* LEFT — brand / features (matches mockup) */}
        <motion.section
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            "flex min-h-0 flex-col",
            isCompact
              ? "relative z-20 shrink-0 items-center pb-3 pt-2 text-center"
              : "justify-center pr-2 lg:pr-6",
          )}
        >
          <div className={cn("flex flex-col", isCompact ? "items-center" : "items-start")}>
            <Image
              src={logoSrc}
              alt="GLOBAL ORBIT PVT LTD"
              width={isCompact ? 240 : 420}
              height={isCompact ? 80 : 135}
              priority
              unoptimized={logoSrc.startsWith("data:")}
              className={cn(
                "h-auto w-auto max-w-full object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.55)]",
                isCompact && "relative z-20",
              )}
              style={{
                width: isCompact ? 220 : splitTight ? 320 : 420,
                height: "auto",
              }}
            />
            {!isCompact ? (
              <p
                className={cn(
                  "mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] sm:text-[0.78rem] sm:tracking-[0.26em]",
                  light ? "text-white drop-shadow" : "text-white/90",
                )}
              >
                Business Email. Built for Professionals.
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              "mt-5 grid gap-3 sm:mt-6 sm:gap-4",
              isCompact ? "hidden" : "grid-cols-4",
            )}
          >
            {FEATURES.map(({ title, body, Icon }) => (
              <div key={title} className="min-w-0">
                <Icon
                  className="mb-1.5 size-5 text-[#e0bc4a] sm:size-6"
                  strokeWidth={1.6}
                />
                <p className="text-sm font-semibold text-white sm:text-[0.95rem]">{title}</p>
                <p
                  className={cn(
                    "mt-0.5 text-[0.68rem] leading-snug sm:text-[0.72rem]",
                    light ? "text-white/85" : "text-white/65",
                  )}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>

          <div
            className={cn(
              "mt-4 grid gap-2.5 sm:mt-5 sm:gap-3",
              isCompact ? "hidden" : "grid-cols-2",
            )}
          >
            {TRUST.map(({ title, body, Icon }) => (
              <div
                key={title}
                className={cn(
                  "flex gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-md sm:px-3.5 sm:py-3",
                  light
                    ? "border-white/35 bg-black/35 text-white"
                    : "border-white/10 bg-black/45",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-[#e0bc4a]" strokeWidth={1.7} />
                <div className="min-w-0 text-left">
                  <p className="text-[0.8rem] font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-[0.68rem] leading-snug text-white/65">{body}</p>
                </div>
              </div>
            ))}
          </div>

          {!isCompact ? (
            <p className="mt-5 flex items-center gap-2 text-[0.68rem] text-white/50">
              <Shield className="size-3.5 text-[#d4af37]/80" />
              © 2025 Global Orbit Pvt Ltd. All rights reserved.
            </p>
          ) : null}
        </motion.section>

        {/* RIGHT — login card */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className={cn(
            "flex min-h-0 w-full flex-col",
            isCompact
              ? "relative z-10 mt-1 shrink-0 justify-start pb-4"
              : "justify-center",
          )}
        >
          <div
            className={cn(
              "w-full rounded-[22px] border p-5 shadow-[0_28px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-6",
              isCompact && "rounded-[24px] p-5",
              light
                ? "border-white/55 bg-white/88 text-slate-900"
                : "border-white/12 bg-[rgba(10,12,20,0.92)] text-white",
            )}
            style={{
              boxShadow: light
                ? "0 0 0 1px rgba(56,189,248,0.25), 0 0 0 1px rgba(212,175,55,0.18) inset, 0 24px 60px rgba(0,0,0,0.28)"
                : "0 0 0 1px rgba(56,189,248,0.35), 0 0 0 1px rgba(212,175,55,0.14) inset, 0 28px 70px rgba(0,0,0,0.55)",
            }}
          >
            <div className="mb-4 text-center sm:mb-5">
              <span
                className={cn(
                  "mx-auto mb-3 inline-flex size-11 items-center justify-center rounded-full border",
                  light
                    ? "border-[#d4af37]/55 bg-[#d4af37]/12 text-[#b8860b]"
                    : "border-[#d4af37]/55 bg-[#d4af37]/12 text-[#e0bc4a]",
                )}
              >
                <Mail className="size-5" strokeWidth={1.7} />
              </span>
              <h1 className="text-[1.15rem] font-bold tracking-tight sm:text-[1.35rem]">
                Welcome to{" "}
                <span className={light ? "text-[#b8860b]" : "text-[#e0bc4a]"}>Global Orbit</span>{" "}
                Mail
              </h1>
              <p
                className={cn(
                  "mt-1.5 text-[0.82rem] sm:text-sm",
                  light ? "text-slate-600" : "text-white/70",
                )}
              >
                Sign in with your{" "}
                <span
                  className={cn(
                    "font-semibold underline decoration-[#d4af37]/70 underline-offset-4",
                    light ? "text-[#b8860b]" : "text-[#e0bc4a]",
                  )}
                >
                  business email
                </span>{" "}
                to continue
              </p>
            </div>

            <form className="space-y-3.5" onSubmit={onSubmit} noValidate>
              <div>
                <label
                  htmlFor="orbit-email"
                  className={cn(
                    "mb-1.5 block text-[0.72rem] font-medium",
                    light ? "text-slate-600" : "text-white/70",
                  )}
                >
                  Email Address
                </label>
                <div
                  className={cn(
                    "flex h-12 items-center gap-2 rounded-[14px] border px-3.5 focus-within:border-[#d4af37]/85 focus-within:ring-[3px] focus-within:ring-[#d4af37]/20",
                    light ? "border-slate-300 bg-white" : "border-white/18 bg-black/75",
                    emailError && "border-red-400/80",
                  )}
                >
                  <User className="size-4 shrink-0 text-[#d4af37]" />
                  <input
                    id="orbit-email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    enterKeyHint="next"
                    placeholder="name@yourdomain.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    className={cn(
                      "h-full w-full bg-transparent text-[16px] outline-none sm:text-sm",
                      light
                        ? "text-slate-900 placeholder:text-slate-400"
                        : "text-white placeholder:text-white/35",
                    )}
                    aria-invalid={Boolean(emailError)}
                  />
                </div>
                {emailError ? (
                  <p className="mt-1 text-xs text-red-400">{emailError}</p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="orbit-password"
                  className={cn(
                    "mb-1.5 block text-[0.72rem] font-medium",
                    light ? "text-slate-600" : "text-white/70",
                  )}
                >
                  Password
                </label>
                <div
                  className={cn(
                    "relative flex h-12 items-center gap-2 rounded-[14px] border px-3.5 focus-within:border-[#d4af37]/85 focus-within:ring-[3px] focus-within:ring-[#d4af37]/20",
                    light ? "border-slate-300 bg-white" : "border-white/18 bg-black/75",
                    passwordError && "border-red-400/80",
                  )}
                >
                  <Lock className="size-4 shrink-0 text-[#d4af37]" />
                  <input
                    id="orbit-password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                    onKeyDown={(e) => setCaps(e.getModifierState("CapsLock"))}
                    className={cn(
                      "h-full w-full bg-transparent pr-10 text-[16px] outline-none sm:text-sm",
                      light
                        ? "text-slate-900 placeholder:text-slate-400"
                        : "text-white placeholder:text-white/35",
                    )}
                    aria-invalid={Boolean(passwordError)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2",
                      light ? "text-[#b8860b]" : "text-[#d4af37]",
                    )}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {passwordError ? (
                  <p className="mt-1 text-xs text-red-400">{passwordError}</p>
                ) : null}
                {caps ? <p className="mt-1 text-xs text-amber-500">Caps Lock is on</p> : null}
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 text-[0.82rem]",
                    light ? "text-slate-700" : "text-white/85",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-4 rounded border-white/30 accent-[#d4af37]"
                  />
                  Remember me
                </label>
                <Link
                  href="https://theglobalorbit.com"
                  className={cn(
                    "text-[0.82rem] font-semibold hover:underline",
                    light ? "text-[#b8860b]" : "text-[#e0bc4a]",
                  )}
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={pending}
                className={cn(
                  "mt-1 flex h-12 w-full items-center justify-center rounded-[14px] text-[0.98rem] font-bold text-[#1a1200] transition",
                  "bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a]",
                  "shadow-[0_10px_28px_rgba(212,175,55,0.35)] hover:brightness-105 disabled:opacity-70",
                )}
              >
                {pending ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-[#1a1200]/25 border-t-[#1a1200]" />
                    Signing in…
                  </span>
                ) : (
                  "Sign In →"
                )}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className={cn("h-px flex-1", light ? "bg-slate-300" : "bg-white/15")} />
              <span className={cn("text-[0.72rem]", light ? "text-slate-500" : "text-white/45")}>
                or
              </span>
              <div className={cn("h-px flex-1", light ? "bg-slate-300" : "bg-white/15")} />
            </div>

            <button
              type="button"
              disabled
              className={cn(
                "flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[14px] border text-[0.8rem] font-medium",
                light
                  ? "border-sky-400/50 bg-sky-50 text-sky-700"
                  : "border-sky-400/45 bg-sky-500/10 text-sky-200",
              )}
            >
              <Shield className="size-3.5" />
              Sign in with SSO{" "}
              <span className={light ? "text-sky-500" : "text-sky-300/80"}>(Coming Soon)</span>
            </button>

            <p
              className={cn(
                "mt-4 text-center text-[0.75rem]",
                light ? "text-slate-600" : "text-white/60",
              )}
            >
              Need help?{" "}
              <Link
                href="https://theglobalorbit.com"
                className={cn(
                  "font-semibold hover:underline",
                  light ? "text-[#b8860b]" : "text-[#e0bc4a]",
                )}
              >
                Contact our support team
              </Link>
            </p>
          </div>

          {isCompact ? (
            <p className="mt-5 flex items-center justify-center gap-2 text-center text-[0.65rem] text-white/55">
              <Shield className="size-3 text-[#d4af37]/80" />
              © 2025 Global Orbit Pvt Ltd. All rights reserved.
            </p>
          ) : null}
        </motion.section>
      </div>
    </div>
  );
}
