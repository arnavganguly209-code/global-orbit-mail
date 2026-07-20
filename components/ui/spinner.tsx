import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2
      className={cn("size-5 animate-spin text-primary", className)}
      aria-label="Loading"
      {...props}
    />
  );
}

export { Spinner };
