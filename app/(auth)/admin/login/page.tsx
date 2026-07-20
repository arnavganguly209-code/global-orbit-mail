import { MarketingShell } from "@/components/layout";
import { GlassPanel } from "@/components/shared/glass-panel";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { LoginFormShell } from "@/features/auth/login-form-shell";

export const metadata = {
  title: "Super Admin",
  description: "Sign in to GLOBAL ORBIT MAIL super admin console.",
};

export default function AdminLoginPage() {
  return (
    <MarketingShell>
      <Container size="sm" className="flex min-h-[70vh] items-center py-16">
        <GlassPanel className="w-full p-8 sm:p-10">
          <div className="mb-8 space-y-4 text-center">
            <div className="flex justify-center">
              <BrandLogo href="/" />
            </div>
            <Badge variant="gold">Super Admin</Badge>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Command center
            </h1>
            <p className="text-sm text-muted-foreground">
              Admin authentication architecture is prepared. Live credentials
              and RBAC enforcement arrive in Phase 2.
            </p>
          </div>
          <LoginFormShell surface="admin" />
        </GlassPanel>
      </Container>
    </MarketingShell>
  );
}
