import type { Metadata } from "next";
import { BookOpen, Globe2, KeyRound, Mailbox, ShieldCheck, Terminal } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingPageHero } from "@/features/marketing/marketing-page";
import { FaqSection } from "@/features/marketing/faq-section";
import { CtaSection } from "@/features/marketing/cta-section";
import { Container } from "@/components/ui/container";
import { GlassPanel } from "@/components/shared/glass-panel";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Guides for setting up domains, DNS authentication, mailboxes, and security on GLOBAL ORBIT MAIL.",
};

const guides = [
  {
    icon: BookOpen,
    title: "Getting started",
    description: "Create your account, choose a plan, and provision your first domain.",
  },
  {
    icon: Globe2,
    title: "Domain & DNS setup",
    description: "Add SPF, DKIM, DMARC, and MX records with copy-paste accuracy.",
  },
  {
    icon: Mailbox,
    title: "Mailboxes & aliases",
    description: "Create, manage, and forward mailboxes across your organization.",
  },
  {
    icon: ShieldCheck,
    title: "Security best practices",
    description: "Password policy, two-factor guidance, and audit logging basics.",
  },
  {
    icon: KeyRound,
    title: "Account & billing",
    description: "Manage subscriptions, invoices, and plan upgrades from your dashboard.",
  },
  {
    icon: Terminal,
    title: "API reference",
    description: "Programmatic access for domains and mailboxes is coming soon.",
  },
];

export default function DocumentationPage() {
  return (
    <MarketingShell>
      <MarketingPageHero
        eyebrow="Documentation"
        title="Guides for running GLOBAL ORBIT MAIL with confidence"
        description="From your first domain to advanced DNS authentication — everything you need to operate mail infrastructure correctly."
      />

      <section className="section-padding relative pt-0">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => (
              <GlassPanel key={guide.title} className="p-6">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <guide.icon className="size-5" />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {guide.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{guide.description}</p>
              </GlassPanel>
            ))}
          </div>
        </Container>
      </section>

      <FaqSection />
      <CtaSection />
    </MarketingShell>
  );
}
