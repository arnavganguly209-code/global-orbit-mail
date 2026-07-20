import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export interface TopbarProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  leading?: React.ReactNode;
}

export function Topbar({ title, description, actions, className, leading }: TopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-[100] flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          {title ? (
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">{title}</h1>
          ) : null}
          {description ? (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
