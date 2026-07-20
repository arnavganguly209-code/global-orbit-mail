import * as React from "react";
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

export { Pagination };
