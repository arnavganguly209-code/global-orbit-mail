import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/layout";
import { Container } from "@/components/ui/container";
import { brand } from "@/config/brand";
import { appConfig } from "@/config/app";
import { routes } from "@/config/routes";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Acceptable Use Policy",
  description: `Acceptable Use Policy for ${brand.product} — rules that keep the platform secure and reliable for every customer.`,
  path: routes.legal.aup,
});

export default function AcceptableUsePage() {
  return (
    <MarketingShell>
      <Container className="section-padding max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-gold">
          Legal
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Acceptable Use Policy
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            This Acceptable Use Policy (“AUP”) governs use of {brand.product} services
            provided by {brand.company}. By using the platform, you agree to operate in a
            manner that protects deliverability, security, and the experience of other
            customers.
          </p>
          <p>You may not use {brand.product} to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Send spam, unsolicited bulk email, or deceptive commercial messages</li>
            <li>Distribute malware, phishing content, or credentials-harvesting schemes</li>
            <li>Violate applicable law, including privacy, export, or intellectual property rules</li>
            <li>Attempt unauthorized access to systems, mailboxes, or customer data</li>
            <li>Interfere with platform stability, scanning, or abuse-prevention controls</li>
          </ul>
          <p>
            We may investigate suspected abuse and suspend or terminate accounts that violate
            this policy. For questions, contact{" "}
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
