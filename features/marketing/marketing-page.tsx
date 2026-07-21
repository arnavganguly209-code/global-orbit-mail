import { MarketingShell } from "@/components/layout/marketing-shell";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function MarketingPageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="section-padding relative overflow-hidden">
      <Container className="relative z-10 max-w-4xl">
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {description}
        </p>
        {children}
      </Container>
    </section>
  );
}

export function MarketingCtaRow() {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Button asChild className="gradient-blue border-0">
        <Link href="/signup">Start free</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/contact">Talk to sales</Link>
      </Button>
    </div>
  );
}

export function MarketingPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShell>{children}</MarketingShell>;
}
