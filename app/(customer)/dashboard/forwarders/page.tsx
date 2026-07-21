import Link from "next/link";
import { CustomerModulePage } from "@/features/customer/module-page";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <CustomerModulePage
      title="Forwarders"
      description="Automatically forward mailbox copies to another address"
      points={[
        "Forward with or without keeping a local copy",
        "Useful for shared inboxes and escalation routing",
        "Forwarders respect your organization's DLP posture",
        "Add or remove forwarders from a mailbox's management panel",
      ]}
    >
      <div className="mb-6">
        <Button asChild variant="outline">
          <Link href="/dashboard/mailboxes">Manage forwarders from Mailboxes</Link>
        </Button>
      </div>
    </CustomerModulePage>
  );
}
