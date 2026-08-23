import Link from "next/link";
import { CustomerModulePage } from "@/features/customer/module-page";

export default function Page() {
  return (
    <CustomerModulePage
      title="Security"
      description="Password policy, two-factor readiness, and session control"
      points={[
        "Strong password enforcement on every account",
        "Change your password from Profile — current password is always verified",
        "Two-factor authentication architecture ready",
        "Session revocation from Profile → Change Password",
        "Audit trail records every sign-in and change",
      ]}
    >
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/dashboard/profile" className="font-medium text-gold hover:underline">
          Open Profile to change your password
        </Link>
      </p>
    </CustomerModulePage>
  );
}
