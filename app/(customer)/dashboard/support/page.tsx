import { CustomerModulePage } from "@/features/customer/module-page";
import { GlassPanel } from "@/components/shared/glass-panel";
import { appConfig } from "@/config/app";

export default function Page() {
  return (
    <CustomerModulePage
      title="Support"
      description="We're here to help with domains, mailboxes, and billing"
      points={[
        "Priority support included on Business Pro and Enterprise",
        "Response times measured in hours, not days",
        "Escalation path to platform engineering for outages",
        "Knowledge base and documentation available anytime",
      ]}
    >
      <GlassPanel className="mb-6 p-6">
        <p className="text-sm text-muted-foreground">
          Email us at{" "}
          <a href={`mailto:${appConfig.supportEmail}`} className="text-primary hover:underline">
            {appConfig.supportEmail}
          </a>{" "}
          and our team will respond shortly.
        </p>
      </GlassPanel>
    </CustomerModulePage>
  );
}
