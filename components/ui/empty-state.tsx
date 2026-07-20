import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center",
        className,
      )}
      {...props}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
