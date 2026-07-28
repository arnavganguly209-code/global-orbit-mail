import Link from "next/link";
import { BookOpen, Headphones, Lock, ShieldCheck, Activity } from "lucide-react";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/routes";

export function MarketingUtilityBar() {
  return (
    <div className="border-b border-white/8 bg-[#05070a] text-[11px] text-zinc-300 sm:text-xs">
      <Container className="flex h-9 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <span className="inline-flex items-center gap-1.5 truncate">
            <ShieldCheck className="size-3.5 shrink-0 text-[#d4af37]" />
            <span className="truncate">99.9% Uptime Guarantee</span>
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <Lock className="size-3.5 shrink-0 text-[#d4af37]" />
            Secure. Reliable. Always.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Link
            href={routes.pages.contact}
            className="inline-flex items-center gap-1 text-zinc-300 transition hover:text-[#f0d78c]"
          >
            <Headphones className="size-3.5 text-[#d4af37]" />
            <span className="hidden sm:inline">Support</span>
          </Link>
          <Link
            href={routes.pages.status}
            className="inline-flex items-center gap-1 text-zinc-300 transition hover:text-[#f0d78c]"
          >
            <Activity className="size-3.5 text-[#d4af37]" />
            <span className="hidden sm:inline">Status</span>
          </Link>
          <Link
            href={routes.pages.documentation}
            className="inline-flex items-center gap-1 text-zinc-300 transition hover:text-[#f0d78c]"
          >
            <BookOpen className="size-3.5 text-[#d4af37]" />
            <span className="hidden md:inline">Documentation</span>
          </Link>
        </div>
      </Container>
    </div>
  );
}
