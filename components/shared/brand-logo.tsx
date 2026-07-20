import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";

export interface BrandLogoProps {
  href?: string | null;
  className?: string;
  /** Pixel width. Header default is brand.logoWidth (240). */
  width?: number;
  priority?: boolean;
}

/**
 * Official GLOBAL ORBIT logo — never stretch; maintain aspect ratio.
 */
export function BrandLogo({
  href = "/",
  className,
  width = brand.logoWidth,
  priority = false,
}: BrandLogoProps) {
  const image = (
    <Image
      src={brand.assets.logo}
      alt={`${brand.company} logo`}
      width={width * 2}
      height={Math.round(width * 0.72)}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
      style={{ width, maxWidth: "100%", height: "auto" }}
    />
  );

  if (href === null || href === undefined) {
    return image;
  }

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${brand.name} home`}
    >
      {image}
    </Link>
  );
}
