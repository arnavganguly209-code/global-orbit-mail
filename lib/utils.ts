import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names with conflict resolution.
 * Canonical utility for GLOBAL ORBIT MAIL design system.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
