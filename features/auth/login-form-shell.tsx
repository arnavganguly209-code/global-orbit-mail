"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { external } from "@/config/routes";

export function LoginFormShell({
  surface,
  nextPath,
}: {
  surface: "user" | "admin";
  nextPath?: string;
}) {
  const router = useRouter();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
  });

  async function onSubmit(values: LoginInput) {
    if (surface === "user") {
      toast.message("User portal login", {
        description: "Redirecting to webmail.theglobalorbit.com",
      });
      window.setTimeout(() => {
        window.location.href = external.webmail;
      }, 400);
      return;
    }

    try {
      const res = await fetch("/api/admin/auth/login", {
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
      toast.success("Signed in");
      router.replace(nextPath || "/orbit");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor={`${surface}-email`}>
          {surface === "admin" ? "Username or email" : "Email"}
        </Label>
        <Input
          id={`${surface}-email`}
          type={surface === "admin" ? "text" : "email"}
          autoComplete={surface === "admin" ? "username" : "email"}
          placeholder={surface === "admin" ? "globalorbit" : "you@company.com"}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${surface}-password`}>Password</Label>
          {surface === "user" ? (
            <Link
              href={external.webmail}
              className="text-xs text-muted-foreground transition-colors hover:text-gold"
            >
              Forgot Password
            </Link>
          ) : null}
        </div>
        <Input
          id={`${surface}-password`}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${surface}-remember`}
          checked={form.watch("remember")}
          onCheckedChange={(checked) => form.setValue("remember", checked === true)}
        />
        <Label htmlFor={`${surface}-remember`} className="font-normal">
          Remember Me
        </Label>
      </div>
      <Button
        type="submit"
        className={`w-full ${
          surface === "admin" ? "gradient-blue-gold border-0 text-white" : "gradient-blue border-0"
        }`}
        size="lg"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
