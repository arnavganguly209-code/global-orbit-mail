import { fail } from "@/lib/api/response";

/**
 * Self-serve payment activation is disabled until the gateway launches.
 * Accounts are activated only by Orbit Super Admin.
 */
export async function POST() {
  return fail(
    "Payment System Temporarily Offline. Online payment integration is currently under maintenance. Contact support@globalorbitmail.cloud or sales@globalorbitmail.cloud to activate your account.",
    503,
  );
}
