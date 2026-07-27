"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Zap,
  Globe2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/features/webmail/hooks/use-layout-mode";

export function OrbitLoginPage() {
  const router = useRouter();
  const layout = useLayoutMode();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [showPass, setShowPass] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [caps, setCaps] = React.useState(false);

  if (!layout) {
    return <div className="min-h-dvh bg-[#050508]" aria-hidden />;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/webmail/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Sign in failed");
      }
      toast.success("Welcome to Global Orbit Mail");
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : "/mail");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  }

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative z-10 w-full max-w-[420px]"
    >
      <div
        className="relative rounded-[20px] border border-white/10 bg-[rgba(12,12,20,0.82)] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-7"
        style={{
          boxShadow:
            "0 0 0 1px rgba(59,130,246,0.28), 0 0 0 1px rgba(212,175,55,0.12) inset, 0 28px 70px rgba(0,0,0,0.55)",
        }}
      >
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full border border-[#d4af37]/50 bg-[#d4af37]/10 text-[#d4af37]">
            <Mail className="size-6" strokeWidth={1.7} />
          </span>
          <h1 className="text-[clamp(1.05rem,2.4vw,1.28rem)] font-bold tracking-tight">
            Welcome to <span className="text-[#f0d78c]">Global Orbit Mail</span>
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Sign in with your <span className="text-[#f0d78c]">business email</span> to continue
          </p>
        </div>

        <form className="space-y-3.5" onSubmit={onSubmit}>
          <div>
            <label htmlFor="orbit-email" className="mb-1.5 block text-xs font-medium text-white/70">
              Email Address
            </label>
            <div className="flex h-11 items-center gap-2 rounded-[11px] border border-white/20 bg-black/80 px-3 focus-within:border-[#d4af37]/80 focus-within:ring-[3px] focus-within:ring-[#d4af37]/20">
              <Mail className="size-4 shrink-0 text-[#f0d78c]/80" />
              <input
                id="orbit-email"
                type="email"
                required
                autoComplete="username"
                placeholder="name@yourdomain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-full w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>
          </div>

          <div>
            <label htmlFor="orbit-password" className="mb-1.5 block text-xs font-medium text-white/70">
              Password
            </label>
            <div className="relative flex h-11 items-center gap-2 rounded-[11px] border border-white/20 bg-black/80 px-3 focus-within:border-[#d4af37]/80 focus-within:ring-[3px] focus-within:ring-[#d4af37]/20">
              <Lock className="size-4 shrink-0 text-[#f0d78c]/80" />
              <input
                id="orbit-password"
                type={showPass ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                onKeyDown={(e) => setCaps(e.getModifierState("CapsLock"))}
                className="h-full w-full bg-transparent pr-10 text-sm text-white outline-none placeholder:text-white/35"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#f0d78c]"
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            {caps ? <p className="mt-1 text-xs text-amber-300">Caps Lock is on</p> : null}
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white/85">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 rounded border-white/30 bg-black accent-[#d4af37]"
              />
              Remember me
            </label>
            <Link href="https://theglobalorbit.com" className="text-sm font-semibold text-[#f0d78c] hover:underline">
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
            {pending ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <p className="mt-4 text-center text-[0.78rem] text-white/65">
          Need help?{" "}
          <Link href="https://theglobalorbit.com" className="font-semibold text-[#f0d78c] hover:underline">
            Contact our support team
          </Link>
        </p>
      </div>
    </motion.div>
  );

  /* —— Desktop / laptop: split hero + glass card —— */
  if (layout === "desktop" || layout === "laptop") {
    return (
      <div className="orbit-login relative min-h-dvh bg-[#050508] text-white">
        <div
          className={cn(
            "grid min-h-dvh",
            layout === "desktop"
              ? "grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]"
              : "grid-cols-[minmax(0,1.2fr)_minmax(340px,1fr)]",
          )}
        >
          <section className="relative overflow-hidden">
            <Image
              src="/brand/login-earth.png"
              alt=""
              fill
              priority
              className="object-cover object-left"
              sizes={layout === "desktop" ? "60vw" : "55vw"}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-black/40 to-black/75" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />

            <div
              className={cn(
                "relative z-10 flex h-full min-h-dvh flex-col py-8",
                layout === "desktop" ? "px-10 xl:px-14" : "px-7",
              )}
            >
              <div className="pt-2">
                <Image
                  src="/brand/logo.png"
                  alt="GLOBAL ORBIT PVT LTD"
                  width={560}
                  height={160}
                  priority
                  className={cn(
                    "h-auto bg-transparent",
                    layout === "desktop" ? "w-[min(560px,78%)] max-w-[560px]" : "w-[min(420px,88%)]",
                  )}
                />
              </div>

              <div className="mt-[clamp(2.5rem,9vh,6rem)]">
                <p className="text-[clamp(0.9rem,1.15vw,1.15rem)] font-bold uppercase tracking-[0.2em] text-white">
                  Business Email. Built for Professionals.
                </p>

                <div
                  className={cn(
                    "mt-8 grid max-w-3xl gap-5",
                    layout === "desktop" ? "grid-cols-4" : "grid-cols-2",
                  )}
                >
                  {[
                    {
                      icon: ShieldCheck,
                      title: "Secure",
                      text: "Enterprise-grade security for your business communications.",
                    },
                    {
                      icon: Mail,
                      title: "Reliable",
                      text: "99.9% uptime and robust infrastructure you can trust.",
                    },
                    {
                      icon: Zap,
                      title: "Fast",
                      text: "Lightning fast delivery so your emails are always on time.",
                    },
                    {
                      icon: Globe2,
                      title: "Global",
                      text: "Access your mail from anywhere in the world.",
                    },
                  ].map((f) => (
                    <article key={f.title}>
                      <f.icon className="mb-2 size-7 text-[#d4af37]" strokeWidth={1.75} />
                      <h3 className="mb-1 text-[0.98rem] font-bold text-[#f0d78c]">{f.title}</h3>
                      <p className="text-[0.78rem] leading-relaxed text-white/70">{f.text}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="mt-auto pb-2 pt-10">
                <div className="flex max-w-[860px] overflow-hidden rounded-2xl border border-[#d4af37]/35 bg-black/55 backdrop-blur-md">
                  <div className="flex flex-1 gap-3 p-4">
                    <Lock className="mt-0.5 size-4 shrink-0 text-[#d4af37]" />
                    <div>
                      <strong className="block text-sm text-white">Your Data. Your Control.</strong>
                      <p className="text-xs text-white/65">We never sell your data. Your privacy is our priority.</p>
                    </div>
                  </div>
                  {layout === "desktop" ? (
                    <>
                      <div className="my-3 w-px bg-[#d4af37]/25" />
                      <div className="flex flex-1 gap-3 p-4">
                        <Building2 className="mt-0.5 size-4 shrink-0 text-[#d4af37]" />
                        <div>
                          <strong className="block text-sm text-white">100% Business Focused</strong>
                          <p className="text-xs text-white/65">
                            Designed exclusively for businesses and professional communication.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-[#f0d78c]/90">
                  © 2025 Global Orbit Pvt Ltd. All rights reserved.
                </p>
              </div>
            </div>
          </section>

          <section className="relative flex items-center justify-center bg-[#07070b] px-6 py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_15%,rgba(59,130,246,0.14),transparent_50%),radial-gradient(ellipse_at_90%_90%,rgba(212,175,55,0.08),transparent_45%)]" />
            {card}
          </section>
        </div>
      </div>
    );
  }

  /* —— Tablet: stacked brand strip + card over earth —— */
  if (layout === "tablet") {
    return (
      <div className="orbit-login relative min-h-dvh overflow-hidden bg-[#050508] text-white">
        <Image src="/brand/login-earth.png" alt="" fill priority className="object-cover object-center" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/70 to-[#050508]" />
        <div className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col items-center px-6 py-10">
          <Image
            src="/brand/logo.png"
            alt="GLOBAL ORBIT PVT LTD"
            width={360}
            height={100}
            priority
            className="mb-6 h-auto w-[min(340px,78%)]"
          />
          <p className="mb-8 text-center text-sm font-bold uppercase tracking-[0.18em] text-white/90">
            Business Email. Built for Professionals.
          </p>
          {card}
          <div className="mt-8 grid w-full max-w-[420px] grid-cols-2 gap-4 text-center">
            {[
              { icon: ShieldCheck, title: "Secure" },
              { icon: Zap, title: "Fast" },
              { icon: Mail, title: "Reliable" },
              { icon: Globe2, title: "Global" },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 backdrop-blur-md">
                <f.icon className="mx-auto mb-1 size-5 text-[#d4af37]" />
                <p className="text-xs font-semibold text-[#f0d78c]">{f.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* —— Mobile: full-bleed earth, logo, glass card —— */
  return (
    <div className="orbit-login relative min-h-dvh overflow-hidden bg-[#050508] text-white">
      <Image src="/brand/login-earth.png" alt="" fill priority className="object-cover object-[30%_center]" sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/75 to-[#050508]" />
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-8">
        <Image
          src="/brand/logo.png"
          alt="GLOBAL ORBIT PVT LTD"
          width={280}
          height={80}
          priority
          className="mb-6 h-auto w-[min(260px,82%)]"
        />
        {card}
        <p className="mt-6 text-center text-[0.7rem] text-white/55">
          © 2025 Global Orbit Pvt Ltd
        </p>
      </div>
    </div>
  );
}
