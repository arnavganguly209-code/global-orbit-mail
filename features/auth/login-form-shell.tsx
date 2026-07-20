"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginFormShell({ surface }: { surface: "user" | "admin" }) {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
  });

  function onSubmit(_values: LoginInput) {
    toast.message("Authentication architecture ready", {
      description:
        surface === "admin"
          ? "Super Admin login will be connected in Phase 2."
          : "User portal login will be connected in Phase 2.",
    });
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
        <Label htmlFor={`${surface}-password`}>Password</Label>
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
          Keep me signed in
        </Label>
      </div>
      <Button type="submit" className="w-full" size="lg">
        Continue
      </Button>
    </form>
  );
}
