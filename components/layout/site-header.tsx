"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Mail, Menu, UserRound, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { external, routes } from "@/config/routes";
import { navItems } from "@/constants/marketing";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "sticky top-0 z-[100] border-b border-white/8 bg-[#05070a]/92 backdrop-blur-xl transition-shadow duration-300",
        scrolled && "shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
      )}
    >
      <Container className="relative flex h-[4.75rem] items-center justify-between gap-3 pb-3 lg:h-[5.5rem]">
        <BrandLogo priority width={220} className="w-[150px] sm:w-[190px] lg:w-[220px]" />

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[13px] font-medium text-zinc-200 transition-colors hover:text-[#f0d78c]"
            >
              {item.label}
              {item.label === "Features" ? <ChevronDown className="size-3.5 opacity-70" /> : null}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={external.webmail}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-10 items-center gap-2 rounded-full border border-[#d4af37]/55 bg-transparent px-4 text-sm font-semibold text-white transition hover:border-[#f0d78c] hover:bg-[#d4af37]/10 sm:inline-flex"
          >
            <Mail className="size-4 text-[#d4af37]" />
            Mail Login
          </a>

          <div className="relative hidden sm:block">
            <Button
              asChild
              className="h-10 rounded-full border-0 bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] px-5 font-bold text-[#1a1200] shadow-[0_8px_22px_rgba(212,175,55,0.28)] hover:brightness-105"
            >
              <Link href={routes.signup} className="inline-flex items-center gap-1.5">
                <UserRound className="size-4" />
                Sign Up
              </Link>
            </Button>
            <Link
              href={routes.signin}
              className="absolute left-0 right-0 top-[calc(100%+2px)] text-center text-[11px] font-medium text-zinc-400 transition hover:text-[#f0d78c]"
            >
              Sign In
            </Link>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-zinc-200 xl:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </Container>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10 xl:hidden"
          >
            <Container className="flex flex-col gap-1 py-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-[#f0d78c]"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 grid gap-2">
                <a
                  href={external.webmail}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#d4af37]/55 text-sm font-semibold text-white"
                >
                  <Mail className="size-4 text-[#d4af37]" />
                  Mail Login
                </a>
                <Button asChild className="h-11 rounded-full border-0 bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] font-bold text-[#1a1200]">
                  <Link href={routes.signup} onClick={() => setOpen(false)}>
                    Sign Up
                  </Link>
                </Button>
                <Link
                  href={routes.signin}
                  onClick={() => setOpen(false)}
                  className="py-1 text-center text-sm font-medium text-zinc-400 hover:text-[#f0d78c]"
                >
                  Sign In
                </Link>
              </div>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
