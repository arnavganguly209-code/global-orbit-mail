"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { routes } from "@/config/routes";

export function CustomerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || routes.dashboard;

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  async function onSubmit(values: LoginInput) {
    try {
      const res = await fetch("/api/customer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
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
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="customer-email">Email</Label>
        <Input
          id="customer-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="customer-password">Password</Label>
          <Link
            href={routes.signin}
            className="text-xs text-muted-foreground transition-colors hover:text-gold"
          >
            Forgot password
          </Link>
        </div>
        <Input
          id="customer-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="customer-remember"
          checked={form.watch("remember")}
          onCheckedChange={(checked) => form.setValue("remember", checked === true)}
        />
        <Label htmlFor="customer-remember" className="font-normal">
          Remember Me
        </Label>
      </div>
      <Button
        type="submit"
        className="w-full gradient-blue border-0"
        size="lg"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Signing in…" : "Sign In"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to GLOBAL ORBIT MAIL?{" "}
        <Link href={routes.signup} className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
