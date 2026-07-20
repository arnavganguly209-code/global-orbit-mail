import * as React from "react";
import { cn } from "@/lib/utils";

export interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
}

const colMap = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
} as const;

function ResponsiveGrid({ className, cols = 3, ...props }: ResponsiveGridProps) {
  return <div className={cn("grid gap-6", colMap[cols], className)} {...props} />;
}

export { ResponsiveGrid };
