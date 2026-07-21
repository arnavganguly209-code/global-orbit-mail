"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function WebmailLoginPage() {
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Webmail session architecture ready");
    router.push("/webmail");
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(47,111,237,0.35),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(212,175,55,0.2),_transparent_50%)]" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass-surface relative z-10 w-full max-w-md rounded-3xl p-8"
      >
        <BrandLogo href="/" width={180} className="mx-auto" />
        <h1 className="mt-6 text-center font-display text-3xl font-semibold">Webmail</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Premium inbox for GLOBAL ORBIT MAIL
        </p>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" required placeholder="you@company.com" />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" required />
          </div>
          <Button type="submit" className="gradient-blue-gold w-full border-0 text-white" size="lg">
            Sign in to Webmail
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          IMAP engine connects in a later phase.{" "}
          <Link href="/dashboard" className="text-gold hover:underline">
            Customer dashboard
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
