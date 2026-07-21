"use client";

import * as React from "react";
import { toast } from "sonner";
import { Mail, MapPin, MessageSquare } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingPageHero } from "@/features/marketing/marketing-page";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassPanel } from "@/components/shared/glass-panel";
import { brand } from "@/config/brand";

const contactPoints = [
  {
    icon: Mail,
    title: "Email",
    detail: `hello@${brand.domain}`,
  },
  {
    icon: MessageSquare,
    title: "Sales & Enterprise",
    detail: "Response within one business day",
  },
  {
    icon: MapPin,
    title: brand.company,
    detail: "Global remote-first team",
  },
];

export default function ContactPage() {
  const [pending, setPending] = React.useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    window.setTimeout(() => {
      setPending(false);
      toast.success("Message received — our team will reply shortly.");
      (event.target as HTMLFormElement).reset();
    }, 600);
  }

  return (
    <MarketingShell>
      <MarketingPageHero
        eyebrow="Contact"
        title="Talk with GLOBAL ORBIT"
        description="Sales, enterprise architecture, or onboarding support — send a note and our team will respond."
      />
      <section className="section-padding relative pt-0">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-4">
              {contactPoints.map((point) => (
                <GlassPanel key={point.title} className="p-6">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <point.icon className="size-5" />
                  </div>
                  <h3 className="font-display text-base font-semibold tracking-tight">
                    {point.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{point.detail}</p>
                </GlassPanel>
              ))}
            </div>
            <form
              onSubmit={onSubmit}
              className="glass-surface premium-shadow grid gap-5 rounded-3xl p-8"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" name="name" required placeholder="Jane Cooper" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="jane@company.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" placeholder="Acme Inc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us about your team and what you need from email hosting."
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="gradient-blue border-0"
                disabled={pending}
              >
                {pending ? "Sending…" : "Send message"}
              </Button>
            </form>
          </div>
        </Container>
      </section>
    </MarketingShell>
  );
}
