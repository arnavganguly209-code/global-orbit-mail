import Link from "next/link";
import { CustomerModulePage } from "@/features/customer/module-page";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <CustomerModulePage
      title="Aliases"
      description="Extra addresses that deliver into an existing mailbox"
      points={[
        "Unlimited aliases per mailbox on Business Pro and above",
        "Aliases inherit the parent mailbox's spam and security policy",
        "Add or remove aliases from a mailbox's management panel",
        "Alias delivery is instant — no DNS changes required",
      ]}
    >
      <div className="mb-6">
        <Button asChild variant="outline">
          <Link href="/dashboard/mailboxes">Manage aliases from Mailboxes</Link>
        </Button>
      </div>
    </CustomerModulePage>
  );
}
