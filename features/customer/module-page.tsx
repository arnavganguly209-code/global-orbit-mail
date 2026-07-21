import { PageHeader } from "@/components/ui/page-header";
import { GlassPanel } from "@/components/shared/glass-panel";

export function CustomerModulePage({
  title,
  description,
  points,
  children,
}: {
  title: string;
  description: string;
  points: string[];
  children?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      {children}
      <GlassPanel className="p-8">
        <p className="text-sm text-muted-foreground">
          This module is wired into your workspace navigation and permissions. Operational
          controls below are ready as your plan and usage grow.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {points.map((point) => (
            <li
              key={point}
              className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm"
            >
              {point}
            </li>
          ))}
        </ul>
      </GlassPanel>
    </>
  );
}
