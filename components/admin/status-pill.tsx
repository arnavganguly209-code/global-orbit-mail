import { cn } from "@/lib/utils";
import type { VerificationTone } from "@/types";

const toneStyles: Record<VerificationTone, string> = {
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  danger: "bg-red-500/15 text-red-400 border-red-500/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusPill({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: VerificationTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        toneStyles[tone],
        className,
      )}
    >
      <span
        className={cn(
          "mr-1.5 size-1.5 rounded-full",
          tone === "success" && "bg-emerald-400",
          tone === "warning" && "bg-amber-300",
          tone === "danger" && "bg-red-400",
          tone === "neutral" && "bg-muted-foreground",
        )}
      />
      {label}
    </span>
  );
}

export function statusToneFromValue(value: string): VerificationTone {
  const v = value.toUpperCase();
  if (["ACTIVE", "VERIFIED", "OPERATIONAL", "SUCCESS"].some((x) => v.includes(x))) {
    return "success";
  }
  if (
    ["PENDING", "VERIFYING", "PARTIAL", "PROVISIONING", "EXPECTED", "WARNING", "AWAITING"].some(
      (x) => v.includes(x),
    )
  ) {
    return "warning";
  }
  if (["FAILED", "ERROR", "EXPIRED", "MISSING", "MISMATCH", "DOWN", "SUSPENDED"].some((x) => v.includes(x))) {
    return "danger";
  }
  return "neutral";
}
