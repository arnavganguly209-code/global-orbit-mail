/**
 * GLOBAL ORBIT MAIL — API Service Layer (architecture)
 * Concrete mail/SMTP/IMAP integrations arrive in later phases.
 */

import type { ApiResponse } from "@/types";

export async function getHealth(): Promise<
  ApiResponse<{ status: string; phase: number; product: string }>
> {
  const response = await fetch("/api/health", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Health check failed");
  }
  return response.json();
}
