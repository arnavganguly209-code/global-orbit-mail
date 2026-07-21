import { Suspense } from "react";
import { Loading } from "@/components/ui/loading";
import { CustomerMailboxesPage } from "@/features/customer/mailboxes-page";

export default function Page() {
  return (
    <Suspense fallback={<Loading label="Loading mailboxes" fullScreen />}>
      <CustomerMailboxesPage />
    </Suspense>
  );
}
