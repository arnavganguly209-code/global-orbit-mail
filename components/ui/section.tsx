import * as React from "react";
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

export { Section };
