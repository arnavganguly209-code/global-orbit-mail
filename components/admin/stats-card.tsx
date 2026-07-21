"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatsCard({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("glass-surface rounded-2xl p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
          <Icon className="size-4" />
        </div>
      </div>
    </motion.div>
  );
}
