import { CustomerModulePage } from "@/features/customer/module-page";

export default function Page() {
  return (
    <CustomerModulePage
      title="Settings"
      description="Workspace preferences and organization details"
      points={[
        "Organization name and branding controls",
        "Notification preferences architecture ready",
        "Timezone and locale preferences",
        "Data export and account deletion requests",
      ]}
    />
  );
}
