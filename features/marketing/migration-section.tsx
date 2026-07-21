"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Container } from "@/components/ui/container";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/features/marketing/section-heading";
import { routes } from "@/config/routes";

export function MigrationSection() {
  return (
    <section id="migration" className="section-padding relative">
      <Container size="md">
        <GlassPanel className="overflow-hidden p-8 sm:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <RefreshCw className="size-5" />
              </div>
              <SectionHeading
                align="left"
                className="mx-0 max-w-xl text-left"
                eyebrow="Migration"
                title="Move to Global Orbit without the chaos"
                description="Bring domains, mailboxes, and authentication over with guided DNS and a clear cutover path. Our team helps you plan the switch so deliverability stays intact."
              />
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
              <Button asChild className="gradient-blue border-0 shadow-lg shadow-primary/25">
                <Link href={routes.pages.contact}>
                  Talk migration
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/5 backdrop-blur-md">
                <Link href={routes.pages.documentation}>Read docs</Link>
              </Button>
            </div>
          </div>
        </GlassPanel>
      </Container>
    </section>
  );
}
