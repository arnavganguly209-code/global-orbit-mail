import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  onRemove?: () => void;
}

function Chip({ className, children, onRemove, ...props }: ChipProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-medium text-secondary-foreground",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 transition-colors hover:bg-background/60"
          aria-label="Remove"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

export { Chip };
