"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { routes } from "@/config/routes";

export function CustomerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || routes.dashboard;

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  async function onSubmit(values: LoginInput) {
    try {
      const res = await fetch("/api/customer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
          remember: values.remember ?? false,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Login failed");
      }
      toast.success("Welcome back");
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate autoComplete="off">
      <div className="space-y-2">
        <label htmlFor="customer-email" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Email
        </label>
        <input
          id="customer-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          className="orbit-login-input"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-red-300">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="customer-password" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Password
          </label>
          <a
            href="mailto:support@globalorbitmail.cloud"
            className="text-xs text-white/45 transition hover:text-[#d4af37]"
          >
            Forgot Password
          </a>
        </div>
        <input
          id="customer-password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter password"
          className="orbit-login-input"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-red-300">{form.formState.errors.password.message}</p>
        ) : null}
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/60">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#2f6fed]"
          checked={Boolean(form.watch("remember"))}
          onChange={(e) => form.setValue("remember", e.target.checked)}
        />
        Remember Me
      </label>
      <button type="submit" className="orbit-login-btn" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Signing in…" : "Sign In"}
      </button>
      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-white/45">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d4af37]" />
        <span>
          Only customers with an active subscription can sign in. Pending or payment-incomplete
          accounts must contact support@globalorbitmail.cloud.
        </span>
      </div>
      <p className="text-center text-sm text-white/50">
        New to GLOBAL ORBIT MAIL?{" "}
        <Link href={routes.signup} className="text-[#60a5fa] hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
