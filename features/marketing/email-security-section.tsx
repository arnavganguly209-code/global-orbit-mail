"use client";

import { ShieldCheck, KeyRound, FileKey2, ScanSearch } from "lucide-react";
import { Container } from "@/components/ui/container";
import { GlassPanel } from "@/components/shared/glass-panel";
import { SectionHeading } from "@/features/marketing/section-heading";

const pillars = [
  {
    icon: ShieldCheck,
    title: "Transport encryption",
    description: "TLS-protected mail paths and encrypted webmail sessions by default.",
  },
  {
    icon: KeyRound,
    title: "SPF · DKIM · DMARC",
    description: "First-class domain authentication so recipients can trust your brand.",
  },
  {
    icon: ScanSearch,
    title: "Threat filtering",
    description: "Multi-layer spam and malware controls that keep inboxes operational.",
  },
  {
    icon: FileKey2,
    title: "Admin governance",
    description: "Clear control over domains, mailboxes, and access without opaque settings.",
  },
];

export function EmailSecuritySection() {
  return (
    <section id="security" className="section-padding relative">
      <Container>
        <SectionHeading
          eyebrow="Email Security"
          title="Security that protects deliverability and reputation"
          description="Enterprise mail only works when authentication, filtering, and access control are designed together — not bolted on later."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <GlassPanel key={pillar.title} className="p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <pillar.icon className="size-5" />
              </div>
              <h3 className="font-display text-lg font-semibold tracking-tight">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {pillar.description}
              </p>
            </GlassPanel>
          ))}
        </div>
      </Container>
    </section>
  );
}
