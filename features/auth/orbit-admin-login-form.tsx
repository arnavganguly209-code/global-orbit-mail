"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { brand } from "@/config/brand";

const orbitLoginSchema = z.object({
  administratorId: z.string().trim().min(2, "Enter your Administrator ID"),
  password: z.string().min(8, "Enter your password"),
  remember: z.boolean().optional(),
});

type OrbitLoginInput = z.infer<typeof orbitLoginSchema>;

export function OrbitAdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/orbit";
  const [showPassword, setShowPassword] = React.useState(false);
  const [ripple, setRipple] = React.useState<{ x: number; y: number } | null>(null);

  const form = useForm<OrbitLoginInput>({
    resolver: zodResolver(orbitLoginSchema),
    defaultValues: {
      administratorId: "",
      password: "",
      remember: false,
    },
  });

  async function onSubmit(values: OrbitLoginInput) {
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: values.administratorId.trim(),
          password: values.password,
          remember: values.remember ?? false,
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Authentication failed");
      }
      toast.success("Welcome to Orbit");
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  function onButtonPointer(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    window.setTimeout(() => setRipple(null), 500);
  }

  const busy = form.formState.isSubmitting;

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate autoComplete="off">
      <div className="space-y-2">
        <label htmlFor="orbit-admin-id" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Administrator ID
        </label>
        <input
          id="orbit-admin-id"
          type="text"
          autoComplete="username"
          spellCheck={false}
          placeholder="Enter administrator ID"
          className="orbit-login-input"
          {...form.register("administratorId")}
        />
        {form.formState.errors.administratorId ? (
          <p className="text-xs text-red-300">{form.formState.errors.administratorId.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="orbit-admin-pass" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Password
          </label>
          <Link
            href="https://theglobalorbit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/45 transition hover:text-[#d4af37]"
          >
            Forgot Password
          </Link>
        </div>
        <div className="relative">
          <input
            id="orbit-admin-pass"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter password"
            className="orbit-login-input pr-12"
            {...form.register("password")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white/80"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {form.formState.errors.password ? (
          <p className="text-xs text-red-300">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/60">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#2f6fed]"
          checked={form.watch("remember")}
          onChange={(e) => form.setValue("remember", e.target.checked)}
        />
        Remember Me
      </label>

      <button
        type="submit"
        disabled={busy}
        onClick={onButtonPointer}
        className="orbit-login-btn relative overflow-hidden"
      >
        {ripple ? (
          <span
            className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-white/30"
            style={{ left: ripple.x, top: ripple.y }}
          />
        ) : null}
        <span className="relative z-10 inline-flex items-center gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Authenticating…" : "Sign In to Orbit"}
        </span>
      </button>

      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-white/45">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d4af37]" />
        <span>
          Session timeout is enforced for inactive consoles. Never share administrator credentials.
          Secure cookies · CSRF · rate-limited authentication.
        </span>
      </div>

      <p className="text-center text-[11px] text-white/35">
        {brand.product} · Enterprise control plane
      </p>
    </form>
  );
}
