"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function WebmailLoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [pending, setPending] = React.useState(false);

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
      toast.success("Welcome to your inbox");
      router.push("/webmail");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[#050810]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(47,111,237,0.35),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(212,175,55,0.22),_transparent_50%)]" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 size-72 rounded-full bg-primary/20 blur-3xl"
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.15, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-1/4 size-72 rounded-full bg-gold/15 blur-3xl"
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-surface premium-shadow relative z-10 w-full max-w-md rounded-3xl border border-white/10 p-8 sm:p-10"
      >
        <div className="flex flex-col items-center text-center">
          <BrandLogo href="/" width={180} />
          <div className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
            <Mail className="size-3.5 text-gold" />
            Webmail
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
            Sign in to your inbox
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Premium mail, calendar, and contacts in one workspace.
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="webmail-email">Email address</Label>
            <Input
              id="webmail-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webmail-password">Password</Label>
            <Input
              id="webmail-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="webmail-remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked === true)}
            />
            <Label htmlFor="webmail-remember" className="font-normal">
              Keep me signed in
            </Label>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full gradient-blue-gold border-0 text-white"
            disabled={pending}
          >
            {pending ? "Signing in…" : "Sign in to Webmail"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-gold" />
          Secured with encrypted sessions and audit logging
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Need mailboxes for your domain?{" "}
          <Link href="/dashboard/mailboxes" className="text-gold hover:underline">
            Manage in dashboard
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
