"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GlassPanelProps {
  className?: string;
  children?: React.ReactNode;
  animate?: boolean;
}

export function GlassPanel({ className, children, animate = true }: GlassPanelProps) {
  const classes = cn("glass-surface rounded-2xl", className);

  if (!animate) {
    return <div className={classes}>{children}</div>;
  }

  return (
    <motion.div
      className={classes}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
