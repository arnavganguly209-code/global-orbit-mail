import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AuroraBackground } from "@/components/shared/aurora-background";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <AuroraBackground className="flex-1">
        <main>{children}</main>
      </AuroraBackground>
      <SiteFooter />
    </div>
  );
}
