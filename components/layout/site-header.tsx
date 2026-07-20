"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { external } from "@/config/routes";
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
        "sticky top-0 z-[100] glass-header transition-shadow duration-300",
        scrolled && "shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
      )}
    >
      <Container className="flex h-[4.75rem] items-center justify-between gap-4 lg:h-20">
        <BrandLogo priority width={240} className="w-[160px] sm:w-[200px] lg:w-[240px]" />

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            asChild
            variant="outline"
            className="hidden border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 sm:inline-flex"
          >
            <a href={external.admin} target="_blank" rel="noopener noreferrer">
              Admin Portal
            </a>
          </Button>
          <Button asChild className="gradient-blue border-0 shadow-lg shadow-primary/25">
            <a href={external.webmail} target="_blank" rel="noopener noreferrer">
              Sign In
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="xl:hidden"
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
            className="overflow-hidden border-t border-border/60 xl:hidden"
          >
            <Container className="flex flex-col gap-1 py-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 grid gap-2 sm:hidden">
                <Button asChild variant="outline">
                  <a href={external.admin} target="_blank" rel="noopener noreferrer">
                    Admin Portal
                  </a>
                </Button>
                <Button asChild>
                  <a href={external.webmail} target="_blank" rel="noopener noreferrer">
                    Sign In
                  </a>
                </Button>
              </div>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
