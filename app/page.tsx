import Link from "next/link";
import { ArrowRight, Shield, Sparkles, Building2 } from "lucide-react";
import { MarketingShell } from "@/components/layout";
import { BrandLogo } from "@/components/shared/brand-logo";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { brand } from "@/config/brand";
import { routes } from "@/config/routes";
import { HeroMotion } from "@/features/marketing/hero-motion";

export default function HomePage() {
  return (
    <MarketingShell>
      <Section className="pb-10 pt-16 sm:pt-20 lg:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <HeroMotion>
            <div className="mb-8 flex justify-center">
              <BrandLogo href={undefined} priority className="scale-110" />
            </div>
            <Badge variant="gold" className="mb-6">
              {brand.tagline}
            </Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              <span className="gradient-text">{brand.product}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              A premium white-label enterprise email platform built for unlimited
              organizations, domains, and mailboxes — with Apple-grade craft and
              Stripe-level product discipline.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={routes.login}>
                  Enter User Portal
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={routes.adminLogin}>Super Admin</Link>
              </Button>
            </div>
          </HeroMotion>
        </div>
      </Section>

      <Section className="pt-4">
        <ResponsiveGrid cols={3}>
          <GlassPanel className="p-6">
            <Shield className="mb-4 size-5 text-primary" />
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Enterprise Trust
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Architecture prepared for RBAC, JWT sessions, and 2FA — without
              compromising the luxury of the experience.
            </p>
          </GlassPanel>
          <GlassPanel className="p-6">
            <Building2 className="mb-4 size-5 text-primary" />
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Unlimited Scale
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Multi-tenant foundations for organizations, domains, users, and
              mailboxes — ready for global growth.
            </p>
          </GlassPanel>
          <GlassPanel className="p-6">
            <Sparkles className="mb-4 size-5 text-gold" />
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Design System First
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A complete reusable component library, theme engine, and motion
              language built exclusively for GLOBAL ORBIT.
            </p>
          </GlassPanel>
        </ResponsiveGrid>
      </Section>

      <Section>
        <Container size="md">
          <GlassPanel className="overflow-hidden p-8 sm:p-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Phase 1 Complete
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  Foundation ready for the world&apos;s most premium mail product.
                </h2>
              </div>
              <Button asChild variant="secondary" size="lg">
                <Link href={routes.api.health}>System Health</Link>
              </Button>
            </div>
          </GlassPanel>
        </Container>
      </Section>
    </MarketingShell>
  );
}
