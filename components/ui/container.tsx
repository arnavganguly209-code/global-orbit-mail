import * as React from "react";
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

export { Container };
