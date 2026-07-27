"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/features/webmail/hooks/use-layout-mode";
import { webmailRoutes } from "@/config/webmail-routes";

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
  const [productName, setProductName] = React.useState("Global Orbit Mail");

  React.useEffect(() => {
    const domain = email.includes("@") ? email.split("@")[1] : "";
    if (!domain || domain.length < 3) return;
    const t = window.setTimeout(() => {
      void fetch(`/api/webmail/branding?domain=${encodeURIComponent(domain)}`)
        .then((r) => r.json())
        .then((json) => {
          if (json?.success && json.data?.loginLogoUrl) {
            setLogoSrc(json.data.loginLogoUrl);
            if (json.data.productName) setProductName(json.data.productName);
          }
        })
        .catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(t);
  }, [email]);

  if (!layout) {
    return <div className="min-h-dvh bg-[#050508]" aria-hidden />;
  }

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
    } else if (password.length < 1) {
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

  const logoWidth =
    layout === "desktop" ? 380 : layout === "laptop" ? 340 : layout === "tablet" ? 300 : 240;

  return (
    <div
      className={cn(
        "orbit-login relative min-h-dvh overflow-hidden font-sans antialiased",
        light ? "text-slate-900" : "text-white",
      )}
    >
      <Image
        src="/brand/login-earth.png"
        alt=""
        fill
        priority
        className="object-cover object-[center_30%]"
        sizes="100vw"
      />
      <div
        className={cn(
          "absolute inset-0",
          light
            ? "bg-gradient-to-b from-white/25 via-black/45 to-black/75"
            : "bg-gradient-to-b from-black/40 via-black/65 to-[#050508]/95",
        )}
      />

      <button
        type="button"
        onClick={() => setTheme(light ? "dark" : "light")}
        className={cn(
          "absolute right-4 top-4 z-20 inline-flex size-10 items-center justify-center rounded-full border backdrop-blur-md transition",
          light
            ? "border-white/40 bg-white/70 text-slate-800 hover:bg-white"
            : "border-white/15 bg-black/40 text-[#f0d78c] hover:bg-black/55",
        )}
        aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      >
        {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </button>

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-7 flex flex-col items-center"
        >
          <Image
            src={logoSrc}
            alt="GLOBAL ORBIT PVT LTD"
            width={logoWidth}
            height={Math.round(logoWidth * 0.32)}
            priority
            unoptimized={logoSrc.startsWith("data:")}
            className="h-auto w-auto max-w-[min(100%,var(--logo-w))] bg-transparent object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{ ["--logo-w" as string]: `${logoWidth}px`, width: logoWidth, height: "auto" }}
          />
          <p
            className={cn(
              "mt-4 text-center text-[0.72rem] font-semibold uppercase tracking-[0.2em] sm:text-xs",
              light ? "text-white/95 drop-shadow" : "text-white/85",
            )}
          >
            Business Email. Built for Professionals.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="w-full max-w-[420px]"
        >
          <div
            className={cn(
              "rounded-[20px] border p-6 shadow-[0_28px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-7",
              light
                ? "border-white/50 bg-white/80 text-slate-900"
                : "border-white/10 bg-[rgba(12,12,20,0.78)] text-white",
            )}
            style={{
              boxShadow: light
                ? "0 0 0 1px rgba(212,175,55,0.2), 0 28px 70px rgba(0,0,0,0.25)"
                : "0 0 0 1px rgba(59,130,246,0.22), 0 0 0 1px rgba(212,175,55,0.12) inset, 0 28px 70px rgba(0,0,0,0.55)",
            }}
          >
            <div className="mb-5 text-center">
              <span className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full border border-[#d4af37]/50 bg-[#d4af37]/10 text-[#d4af37]">
                <Mail className="size-6" strokeWidth={1.7} />
              </span>
              <h1 className="text-[clamp(1.15rem,2.6vw,1.4rem)] font-bold tracking-tight">
                Welcome to <span className="text-[#d4af37]">{productName}</span>
              </h1>
              <p className={cn("mt-1 text-sm", light ? "text-slate-600" : "text-white/70")}>
                Sign in with your <span className="font-medium text-[#d4af37]">business email</span> to
                continue
              </p>
            </div>

            <form className="space-y-3.5" onSubmit={onSubmit} noValidate>
              <div>
                <label
                  htmlFor="orbit-email"
                  className={cn("mb-1.5 block text-xs font-medium", light ? "text-slate-600" : "text-white/70")}
                >
                  Email Address
                </label>
                <div
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-[11px] border px-3 focus-within:border-[#d4af37]/80 focus-within:ring-[3px] focus-within:ring-[#d4af37]/20",
                    light ? "border-slate-300 bg-white" : "border-white/20 bg-black/80",
                    emailError && "border-red-400/80",
                  )}
                >
                  <Mail className="size-4 shrink-0 text-[#d4af37]" />
                  <input
                    id="orbit-email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="name@yourdomain.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    className={cn(
                      "h-full w-full bg-transparent text-sm outline-none",
                      light
                        ? "text-slate-900 placeholder:text-slate-400"
                        : "text-white placeholder:text-white/35",
                    )}
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? "orbit-email-error" : undefined}
                  />
                </div>
                {emailError ? (
                  <p id="orbit-email-error" className="mt-1 text-xs text-red-400">
                    {emailError}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="orbit-password"
                  className={cn("mb-1.5 block text-xs font-medium", light ? "text-slate-600" : "text-white/70")}
                >
                  Password
                </label>
                <div
                  className={cn(
                    "relative flex h-11 items-center gap-2 rounded-[11px] border px-3 focus-within:border-[#d4af37]/80 focus-within:ring-[3px] focus-within:ring-[#d4af37]/20",
                    light ? "border-slate-300 bg-white" : "border-white/20 bg-black/80",
                    passwordError && "border-red-400/80",
                  )}
                >
                  <Lock className="size-4 shrink-0 text-[#d4af37]" />
                  <input
                    id="orbit-password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                    onKeyDown={(e) => setCaps(e.getModifierState("CapsLock"))}
                    className={cn(
                      "h-full w-full bg-transparent pr-10 text-sm outline-none",
                      light
                        ? "text-slate-900 placeholder:text-slate-400"
                        : "text-white placeholder:text-white/35",
                    )}
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={passwordError ? "orbit-password-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#d4af37]"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {passwordError ? (
                  <p id="orbit-password-error" className="mt-1 text-xs text-red-400">
                    {passwordError}
                  </p>
                ) : null}
                {caps ? <p className="mt-1 text-xs text-amber-500">Caps Lock is on</p> : null}
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 text-sm",
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
                  className="text-sm font-semibold text-[#d4af37] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={pending}
                className={cn(
                  "mt-1 flex h-11 w-full items-center justify-center rounded-full text-[0.95rem] font-bold text-[#1a1200] transition",
                  "bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a]",
                  "shadow-[0_10px_28px_rgba(212,175,55,0.32)] hover:brightness-105 disabled:opacity-70",
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

            <p className={cn("mt-4 text-center text-[0.78rem]", light ? "text-slate-600" : "text-white/65")}>
              Need help?{" "}
              <Link
                href="https://theglobalorbit.com"
                className="font-semibold text-[#d4af37] hover:underline"
              >
                Contact our support team
              </Link>
            </p>
          </div>
        </motion.div>

        <p className={cn("mt-8 text-center text-[0.7rem]", light ? "text-white/80" : "text-white/55")}>
          © 2026 Global Orbit Pvt Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
