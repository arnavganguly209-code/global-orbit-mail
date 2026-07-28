import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MarketingUtilityBar } from "@/components/layout/marketing-utility-bar";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[#05070a] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#05070a]" />
      <MarketingUtilityBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
