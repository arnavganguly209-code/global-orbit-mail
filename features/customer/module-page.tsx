import { CustomerShell } from "@/components/customer/customer-shell";

export function CustomerModulePage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <CustomerShell title={title} description={description}>
      <div className="glass-surface rounded-2xl p-6 text-sm text-muted-foreground">
        {children ?? (
          <p>
            {title} is connected to the SaaS architecture. Live workflows use PostgreSQL via the
            customer dashboard APIs.
          </p>
        )}
      </div>
    </CustomerShell>
  );
}
