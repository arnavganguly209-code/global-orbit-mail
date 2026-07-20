"use client";

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

export { Search };
