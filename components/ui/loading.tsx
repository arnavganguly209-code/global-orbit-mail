import * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

export interface LoadingProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

function Loading({ label = "Loading", className, fullScreen }: LoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground",
        fullScreen && "min-h-[50vh]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export { Loading };
