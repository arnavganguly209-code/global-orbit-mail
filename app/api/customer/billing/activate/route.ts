import { fail } from "@/lib/api/response";

/** Self-serve billing activation disabled — Orbit Super Admin only. */
export async function POST() {
  return fail(
    "Payment System Temporarily Offline. Contact sales@globalorbitmail.cloud to activate your subscription.",
    503,
  );
}
