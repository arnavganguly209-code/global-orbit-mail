"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { customerFetch } from "@/lib/api/customer-fetch";
import { adminFetch } from "@/lib/api/admin-fetch";

type Variant = "customer" | "webmail" | "admin";

export function ChangePasswordForm({
  variant = "customer",
  endpoint,
  extraHeaders,
}: {
  variant?: Variant;
  endpoint: string;
  extraHeaders?: HeadersInit;
}) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [show, setShow] = React.useState({ current: false, next: false, confirm: false });
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const webmail = variant === "webmail";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    if (!currentPassword) {
      setFormError("Enter your current password.");
      return;
    }
    if (!newPassword) {
      setFormError("Enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    setPending(true);
    try {
      const requestInit: RequestInit = {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...extraHeaders,
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      };
      const res =
        variant === "customer"
          ? await customerFetch(endpoint, requestInit)
          : variant === "admin"
            ? await adminFetch(endpoint, requestInit)
            : await fetch(endpoint, requestInit);
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      if (!res.ok || json.success === false) {
        const message = json.message || "Unable to change password.";
        setFormError(message);
        toast.error(message);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      const okMsg = json.message || "Password changed";
      setSuccess(okMsg);
      toast.success(okMsg);
    } catch {
      const message = "Unable to change password.";
      setFormError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const fieldClass = webmail
    ? "h-11 rounded-xl border border-white/10 bg-black/40 text-white placeholder:text-zinc-500 focus-visible:ring-[#d9b15c]/70"
    : undefined;

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" autoComplete="off">
      <div className="flex items-center gap-2">
        <Lock className={cn("size-4", webmail ? "text-[#d9b15c]" : "text-gold")} />
        <h2
          className={cn(
            "font-semibold tracking-tight",
            webmail ? "text-lg text-white" : "font-display text-xl",
          )}
        >
          Change Password
        </h2>
      </div>
      <p className={cn("text-sm", webmail ? "text-zinc-400" : "text-muted-foreground")}>
        Verify your current password, then choose a new one. Other devices will be signed out.
      </p>

      <PasswordField
        id="current-password"
        label="Current Password"
        value={currentPassword}
        onChange={setCurrentPassword}
        visible={show.current}
        onToggle={() => setShow((s) => ({ ...s, current: !s.current }))}
        autoComplete="current-password"
        className={fieldClass}
        disabled={pending}
      />
      <PasswordField
        id="new-password"
        label="New Password"
        value={newPassword}
        onChange={setNewPassword}
        visible={show.next}
        onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
        autoComplete="new-password"
        className={fieldClass}
        disabled={pending}
      />
      <p className={cn("text-xs", webmail ? "text-zinc-500" : "text-muted-foreground")}>
        At least 12 characters with upper, lower, and a number.
      </p>
      <PasswordField
        id="confirm-password"
        label="Confirm New Password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        visible={show.confirm}
        onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
        autoComplete="new-password"
        className={fieldClass}
        disabled={pending}
      />

      {formError ? (
        <p className="text-sm font-medium text-red-400" role="alert">
          {formError}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm font-medium text-emerald-400" role="status">
          {success}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        variant={webmail ? undefined : "gold"}
        className={
          webmail
            ? "rounded-full bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] px-6 py-3 font-bold text-[#1a1200] hover:brightness-105"
            : undefined
        }
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Changing password…
          </>
        ) : (
          "Change Password"
        )}
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  className,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={cn("pr-10", className)}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-[#d9b15c]"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
