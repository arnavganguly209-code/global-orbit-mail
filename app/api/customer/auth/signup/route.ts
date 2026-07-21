import { fail } from "@/lib/api/response";

/**
 * Public self-serve account creation is disabled while payment is offline.
 * Customers register via the signup UI (draft only). Orbit Super Admin creates
 * and activates accounts at /orbit/customers.
 */
export async function POST() {
  return fail(
    "Self-serve account creation is temporarily disabled. Complete the registration and plan selection, then contact sales@globalorbitmail.cloud or support@globalorbitmail.cloud. Orbit Super Admin activates accounts manually.",
    503,
  );
}
