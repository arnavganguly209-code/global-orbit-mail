import { ok, fail } from "@/lib/api/response";
import { customerLogin } from "@/services/auth/customer-auth";

export async function POST(request: Request) {
  try {
    const data = await customerLogin(request);
    return ok(data, undefined, "Signed in");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    const status =
      typeof error === "object" &&
      error &&
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : message.includes("locked") || message.includes("Too many")
          ? 429
          : 400;
    return fail(message, status);
  }
}
