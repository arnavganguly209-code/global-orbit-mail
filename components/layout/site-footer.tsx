import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Container } from "@/components/ui/container";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { appConfig } from "@/config/app";
import { external, routes } from "@/config/routes";

const social = [
  { label: "X", href: "https://x.com" },
  { label: "LinkedIn", href: "https://linkedin.com" },
  { label: "GitHub", href: "https://github.com" },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60">
      <div className="pointer-events-none absolute inset-0 glass-surface opacity-40" />
      <Container className="relative py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <BrandLogo width={240} className="w-[200px] sm:w-[240px]" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {brand.product} is the premium white-label enterprise email hosting
              platform from {brand.company} — secure, scalable, and built for modern
              business.
            </p>
            <div className="flex gap-3">
              {social.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <p className="font-medium text-foreground">Quick Links</p>
            <Link href={routes.sections.features} className="block text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href={routes.sections.solutions} className="block text-muted-foreground hover:text-foreground">
              Solutions
            </Link>
            <Link href={routes.sections.pricing} className="block text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href={routes.sections.documentation} className="block text-muted-foreground hover:text-foreground">
              Documentation
            </Link>
            <a href={external.webmail} className="block text-muted-foreground hover:text-foreground">
              Support
            </a>
            <Link href={routes.sections.contact} className="block text-muted-foreground hover:text-foreground">
              Contact
            </Link>
          </div>

          <div className="space-y-3 text-sm">
            <p className="font-medium text-foreground">Legal</p>
            <Link href={routes.legal.privacy} className="block text-muted-foreground hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href={routes.legal.terms} className="block text-muted-foreground hover:text-foreground">
              Terms
            </Link>
            <Link href={routes.legal.refund} className="block text-muted-foreground hover:text-foreground">
              Refund Policy
            </Link>
            <Link href={routes.legal.cookies} className="block text-muted-foreground hover:text-foreground">
              Cookies
            </Link>
          </div>

          <div className="space-y-3 text-sm">
            <p className="font-medium text-foreground">Newsletter</p>
            <p className="text-muted-foreground">
              Product notes for operators who care about mail infrastructure.
            </p>
            <form className="flex gap-2">
              <Input type="email" placeholder="you@company.com" aria-label="Email" />
              <Button type="button" variant="secondary">
                Join
              </Button>
            </form>
            <a
              href={`mailto:${appConfig.supportEmail}`}
              className="block text-muted-foreground hover:text-foreground"
            >
              {appConfig.supportEmail}
            </a>
          </div>
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {brand.company}. All rights reserved.</p>
          <p>
            Developed by{" "}
            <a
              href={external.company}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold transition-colors hover:text-foreground"
            >
              Global Orbit
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
