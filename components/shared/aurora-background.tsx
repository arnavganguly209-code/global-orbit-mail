"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AuroraBackgroundProps {
  className?: string;
  children?: React.ReactNode;
}

export function AuroraBackground({ className, children }: AuroraBackgroundProps) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-0 mesh-gradient" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,var(--aurora-1),transparent_70%)] blur-3xl animate-aurora"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-32 h-80 w-80 rounded-full bg-[radial-gradient(circle,var(--aurora-3),transparent_70%)] blur-3xl animate-aurora animate-pulse-glow"
        style={{ animationDelay: "2s" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--aurora-2),transparent_70%)] blur-3xl animate-float"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
