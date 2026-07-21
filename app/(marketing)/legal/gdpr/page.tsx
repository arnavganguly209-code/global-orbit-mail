import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/layout";
import { Container } from "@/components/ui/container";
import { brand } from "@/config/brand";
import { appConfig } from "@/config/app";
import { routes } from "@/config/routes";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "GDPR",
  description: `GDPR overview for ${brand.product} — how ${brand.company} approaches privacy, data processing, and customer rights.`,
  path: routes.legal.gdpr,
});

export default function GdprPage() {
  return (
    <MarketingShell>
      <Container className="section-padding max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-gold">
          Legal
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">GDPR</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            {brand.company} is committed to handling personal data carefully when providing{" "}
            {brand.product}. This page summarizes our GDPR-oriented posture for customers and
            prospects evaluating the platform.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Customers remain controllers of mailbox content they process on the platform</li>
            <li>We process service data only as needed to deliver and secure email hosting</li>
            <li>Access is limited to authorized personnel under operational need</li>
            <li>Requests related to access, correction, or deletion can be routed via support</li>
            <li>Enterprise agreements may include additional data-processing terms</li>
          </ul>
          <p>
            For privacy or GDPR inquiries, contact{" "}
            <a className="text-primary hover:underline" href={`mailto:${appConfig.supportEmail}`}>
              {appConfig.supportEmail}
            </a>{" "}
            or review our{" "}
            <Link href={routes.legal.privacy} className="text-primary hover:underline">
              Privacy Policy
            </Link>
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
