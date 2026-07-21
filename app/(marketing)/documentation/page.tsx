import type { Metadata } from "next";
import {
  MarketingPage,
  MarketingPageHero,
} from "@/features/marketing/marketing-page";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Documentation" };

const docs = [
  { title: "Getting started", body: "Sign up, choose a plan, and unlock your dashboard." },
  { title: "Add a domain", body: "Create a domain and follow the DNS wizard for MX, SPF, DKIM, DMARC." },
  { title: "Create mailboxes", body: "Provision addresses, quotas, aliases, and forwarders." },
  { title: "Open webmail", body: "Sign in at webmail.globalorbitmail.com for inbox and compose." },
];

export default function DocumentationPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Docs"
        title="Documentation"
        description="Guides for onboarding, DNS, mailboxes, and the customer dashboard."
      />
      <Container className="grid gap-4 pb-24 md:grid-cols-2">
        {docs.map((doc) => (
          <article key={doc.title} className="glass-surface rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">{doc.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{doc.body}</p>
          </article>
        ))}
      </Container>
    </MarketingPage>
  );
}
