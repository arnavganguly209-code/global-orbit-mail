import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Container } from "@/components/ui/container";
import { Separator } from "@/components/ui/separator";
import { brand } from "@/config/brand";
import { appConfig } from "@/config/app";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/80">
      <Container className="py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <BrandLogo />
            <p className="max-w-sm text-sm text-muted-foreground">{brand.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div className="space-y-2">
              <p className="font-medium text-foreground">Product</p>
              <p className="text-muted-foreground">Enterprise Mail</p>
              <p className="text-muted-foreground">White-label Ready</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Portals</p>
              <Link
                href={`https://${brand.portals.user}`}
                className="block text-muted-foreground transition-colors hover:text-foreground"
              >
                User Portal
              </Link>
              <Link
                href={`https://${brand.portals.admin}`}
                className="block text-muted-foreground transition-colors hover:text-foreground"
              >
                Super Admin
              </Link>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Company</p>
              <p className="text-muted-foreground">{brand.company}</p>
              <a
                href={`mailto:${appConfig.supportEmail}`}
                className="block text-muted-foreground transition-colors hover:text-foreground"
              >
                {appConfig.supportEmail}
              </a>
            </div>
          </div>
        </div>
        <Separator className="my-8" />
        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.company}. All rights reserved.
          </p>
          <p>Phase {appConfig.phase} Foundation</p>
        </div>
      </Container>
    </footer>
  );
}
