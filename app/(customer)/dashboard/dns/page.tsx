import Link from "next/link";
import { CustomerModulePage } from "@/features/customer/module-page";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <CustomerModulePage
      title="DNS Setup"
      description="MX · SPF · DKIM · DMARC authentication guidance"
      points={[
        "Full DNS wizard lives on each domain's detail view",
        "MX routes inbound mail to your mailboxes",
        "SPF, DKIM, and DMARC harden deliverability and anti-spoofing",
        "Changes typically propagate within a few minutes to a few hours",
      ]}
    >
      <div className="mb-6">
        <Button asChild className="gradient-blue border-0">
          <Link href="/dashboard/domains">Open DNS Wizard</Link>
        </Button>
      </div>
    </CustomerModulePage>
  );
}
