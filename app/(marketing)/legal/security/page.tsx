import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/layout";
import { Container } from "@/components/ui/container";
import { brand } from "@/config/brand";
import { appConfig } from "@/config/app";
import { routes } from "@/config/routes";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Security",
  description: `Security practices for ${brand.product} — encryption, authentication, monitoring, and operational controls for enterprise mail.`,
  path: routes.legal.security,
});

export default function SecurityPage() {
  return (
    <MarketingShell>
      <Container className="section-padding max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-gold">
          Legal
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Security</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            {brand.product} is designed with defense-in-depth for organizations that treat
            email as critical infrastructure. Security is applied across transport,
            authentication, access, and operations.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>TLS encryption for mail transport and web access</li>
            <li>Domain authentication with SPF, DKIM, and DMARC guidance</li>
            <li>Spam and malware filtering to reduce inbound risk</li>
            <li>Role-aware administration for domains and mailboxes</li>
            <li>Monitoring and operational visibility for platform health</li>
          </ul>
          <p>
            For security disclosures or enterprise diligence requests, contact{" "}
            <a className="text-primary hover:underline" href={`mailto:${appConfig.supportEmail}`}>
              {appConfig.supportEmail}
            </a>
            .
          </p>
        </div>
        <Link href="/" className="mt-10 inline-block text-sm text-gold hover:underline">
          Back to home
        </Link>
      </Container>
    </MarketingShell>
  );
}
