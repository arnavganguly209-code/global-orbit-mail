import { CustomerModulePage } from "@/features/customer/module-page";

export default function Page() {
  return (
    <CustomerModulePage
      title="Security"
      description="Password policy, two-factor readiness, and session control"
      points={[
        "Strong password enforcement on every account",
        "Two-factor authentication architecture ready",
        "Session revocation from Profile → Change password",
        "Audit trail records every sign-in and change",
      ]}
    />
  );
}
