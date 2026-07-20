/**
 * GLOBAL ORBIT MAIL — UI Design System Scaffold (Batch C)
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.trimStart() + "\n");
  console.log("✓", rel);
}

write(
  "components/ui/table.tsx",
  `import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("p-4 align-middle", className)} {...props} />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };`,
);

write(
  "components/ui/data-grid.tsx",
  `import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataGridColumn<T> {
  key: keyof T | string;
  header: string;
  className?: string;
  cell?: (row: T) => React.ReactNode;
}

export interface DataGridProps<T extends object> {
  columns: DataGridColumn<T>[];
  data: T[];
  className?: string;
  emptyMessage?: string;
}

function DataGrid<T extends object>({
  columns,
  data,
  className,
  emptyMessage = "No records found.",
}: DataGridProps<T>) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={String(column.key)} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={String(column.key)} className={column.className}>
                    {column.cell
                      ? column.cell(row)
                      : String((row as Record<string, unknown>)[column.key as string] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export { DataGrid };`,
);

write(
  "components/ui/pagination.tsx",
  `import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  return (
    <nav
      className={cn("flex items-center justify-between gap-3", className)}
      aria-label="Pagination"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" />
        Previous
      </Button>
      <p className="text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of{" "}
        <span className="font-medium text-foreground">{pageCount}</span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

export { Pagination };`,
);

write(
  "components/ui/search.tsx",
  `"use client";

import * as React from "react";
import { Search as SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface SearchProps extends React.ComponentProps<"input"> {
  containerClassName?: string;
}

function Search({ className, containerClassName, ...props }: SearchProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn("pl-9", className)} type="search" {...props} />
    </div>
  );
}

export { Search };`,
);

write(
  "components/ui/empty-state.tsx",
  `import * as React from "react";
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

export { EmptyState };`,
);

write(
  "components/ui/loading.tsx",
  `import { cn } from "@/lib/utils";
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

export { Loading };`,
);

write(
  "components/ui/toast.tsx",
  `"use client";

import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "next-themes";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };`,
);

write(
  "components/ui/breadcrumb.tsx",
  `import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={\`\${item.label}-\${index}\`}>
            {index > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" /> : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? "font-medium text-foreground" : "text-muted-foreground")}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export { Breadcrumb };`,
);

write(
  "components/ui/page-header.tsx",
  `import * as React from "react";
import { cn } from "@/lib/utils";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8 space-y-4", className)}>
      {breadcrumbs ? <Breadcrumb items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export { PageHeader };`,
);

write(
  "components/ui/container.tsx",
  `import * as React from "react";
import { cn } from "@/lib/utils";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const sizeMap = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
  xl: "max-w-[90rem]",
  full: "max-w-none",
} as const;

function Container({ className, size = "lg", ...props }: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full px-5 sm:px-6 lg:px-8", sizeMap[size], className)}
      {...props}
    />
  );
}

export { Container };`,
);

write(
  "components/ui/section.tsx",
  `import * as React from "react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/container";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  containerSize?: React.ComponentProps<typeof Container>["size"];
}

function Section({ className, children, containerSize = "lg", ...props }: SectionProps) {
  return (
    <section className={cn("section-padding", className)} {...props}>
      <Container size={containerSize}>{children}</Container>
    </section>
  );
}

export { Section };`,
);

write(
  "components/ui/responsive-grid.tsx",
  `import * as React from "react";
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

export { ResponsiveGrid };`,
);

write(
  "components/ui/switch.tsx",
  `"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };`,
);

write(
  "components/ui/scroll-area.tsx",
  `"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-px",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-px",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };`,
);

write(
  "components/ui/index.ts",
  `export * from "@/components/ui/button";
export * from "@/components/ui/input";
export * from "@/components/ui/textarea";
export * from "@/components/ui/label";
export * from "@/components/ui/card";
export * from "@/components/ui/badge";
export * from "@/components/ui/chip";
export * from "@/components/ui/avatar";
export * from "@/components/ui/separator";
export * from "@/components/ui/checkbox";
export * from "@/components/ui/radio-group";
export * from "@/components/ui/skeleton";
export * from "@/components/ui/spinner";
export * from "@/components/ui/progress";
export * from "@/components/ui/dialog";
export * from "@/components/ui/modal";
export * from "@/components/ui/drawer";
export * from "@/components/ui/tooltip";
export * from "@/components/ui/popover";
export * from "@/components/ui/dropdown-menu";
export * from "@/components/ui/select";
export * from "@/components/ui/tabs";
export * from "@/components/ui/accordion";
export * from "@/components/ui/table";
export * from "@/components/ui/data-grid";
export * from "@/components/ui/pagination";
export * from "@/components/ui/search";
export * from "@/components/ui/empty-state";
export * from "@/components/ui/loading";
export * from "@/components/ui/toast";
export * from "@/components/ui/breadcrumb";
export * from "@/components/ui/page-header";
export * from "@/components/ui/container";
export * from "@/components/ui/section";
export * from "@/components/ui/responsive-grid";
export * from "@/components/ui/switch";
export * from "@/components/ui/scroll-area";`,
);

console.log("UI scaffold batch C complete");
