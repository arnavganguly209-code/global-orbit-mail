import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";

export interface BrandLogoProps {
  href?: string;
  showWordmark?: boolean;
  className?: string;
  markClassName?: string;
  priority?: boolean;
}

/**
 * Swappable brand mark — replace assets in /public/brand without redesigning UI.
 */
export function BrandLogo({
  href = "/",
  showWordmark = true,
  className,
  markClassName,
  priority = false,
}: BrandLogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Image
        src={brand.assets.logoMark}
        alt={`${brand.name} mark`}
        width={36}
        height={36}
        priority={priority}
        className={cn("size-9 rounded-xl", markClassName)}
      />
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {brand.name}
          </span>
          <span className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground">
            MAIL
          </span>
        </span>
      ) : null}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="outline-none transition-opacity hover:opacity-90">
      {content}
    </Link>
  );
}
