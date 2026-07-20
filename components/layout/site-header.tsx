"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/routes";

export function SiteHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-[100] border-b border-border/60 bg-background/70 backdrop-blur-xl"
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <BrandLogo priority />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href={routes.adminLogin}>Admin</Link>
          </Button>
          <Button asChild>
            <Link href={routes.login}>Sign in</Link>
          </Button>
        </div>
      </Container>
    </motion.header>
  );
}
