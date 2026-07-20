"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { external } from "@/config/routes";

export function LoginFormShell({ surface }: { surface: "user" | "admin" }) {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
  });

  const portalUrl = surface === "admin" ? external.admin : external.webmail;

  function onSubmit(_values: LoginInput) {
    toast.message("Opening production portal", {
      description: `Redirecting to ${portalUrl.replace("https://", "")}`,
    });
    window.setTimeout(() => {
      window.location.href = portalUrl;
    }, 600);
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor={`${surface}-email`}>Email</Label>
        <Input
          id={`${surface}-email`}
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
          <Label htmlFor={`${surface}-password`}>Password</Label>
          <Link
            href={portalUrl}
            className="text-xs text-muted-foreground transition-colors hover:text-gold"
          >
            Forgot Password
          </Link>
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
        className={`w-full ${surface === "admin" ? "gradient-blue-gold border-0 text-white" : "gradient-blue border-0"}`}
        size="lg"
      >
        Sign In
      </Button>
    </form>
  );
}
