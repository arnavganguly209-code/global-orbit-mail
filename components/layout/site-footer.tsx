import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Container } from "@/components/ui/container";
import { Separator } from "@/components/ui/separator";
import { brand } from "@/config/brand";
import { appConfig } from "@/config/app";
import { external, routes } from "@/config/routes";

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Products",
    links: [
      { label: "Features", href: routes.pages.features },
      { label: "Pricing", href: routes.pages.pricing },
      { label: "Business Email", href: routes.pages.businessEmail },
      { label: "Enterprise", href: routes.pages.enterprise },
      { label: "Webmail", href: external.webmail, external: true },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Business Email", href: routes.pages.businessEmail },
      { label: "Enterprise", href: routes.pages.enterprise },
      { label: "White-label hosting", href: routes.pages.enterprise },
      { label: "Domain authentication", href: routes.sections.security },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: routes.pages.about },
      { label: "Contact", href: routes.pages.contact },
      { label: "Status", href: routes.pages.status },
      {
        label: brand.name,
        href: external.company,
        external: true,
      },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: routes.pages.documentation },
      { label: "Pricing", href: routes.pages.pricing },
      { label: "Features", href: routes.pages.features },
      { label: "Migration", href: routes.sections.migration },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: routes.legal.privacy },
      { label: "Terms", href: routes.legal.terms },
      { label: "Refund", href: routes.legal.refund },
      { label: "Cookies", href: routes.legal.cookies },
      { label: "Acceptable Use", href: routes.legal.aup },
      { label: "Security", href: routes.legal.security },
      { label: "GDPR", href: routes.legal.gdpr },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact", href: routes.pages.contact },
      { label: "Documentation", href: routes.pages.documentation },
      { label: "Status", href: routes.pages.status },
      { label: "Webmail", href: external.webmail, external: true },
      {
        label: appConfig.supportEmail,
        href: `mailto:${appConfig.supportEmail}`,
        external: true,
      },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  const className =
    "block text-sm text-muted-foreground transition-colors hover:text-foreground";

  if (link.external) {
    return (
      <a
        href={link.href}
        target={link.href.startsWith("mailto:") ? undefined : "_blank"}
        rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
        className={className}
      >
        {link.label}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60">
      <div className="pointer-events-none absolute inset-0 glass-surface opacity-40" />
      <Container className="relative py-14 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2.85fr)] lg:gap-16">
          <div className="max-w-sm space-y-5">
            <BrandLogo width={240} className="w-[200px] sm:w-[240px]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {brand.product} is premium white-label enterprise email hosting from{" "}
              {brand.company} — secure, scalable, and built for modern business.
            </p>
            <p className="text-xs tracking-wide text-muted-foreground/80">
              {brand.domain}
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {columns.map((column) => (
              <div key={column.title} className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground">
                  {column.title}
                </p>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.label}`}>
                      <FooterLinkItem link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {brand.company}. All rights reserved.</p>
          <p>
            Developed by{" "}
            <a
              href={external.company}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold transition-colors hover:text-foreground"
            >
              {brand.name}
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
