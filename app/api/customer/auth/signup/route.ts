import { ok, fail } from "@/lib/api/response";
import { customerSignup } from "@/services/auth/customer-auth";

export async function POST(request: Request) {
  try {
    const data = await customerSignup(request);
    return ok(data, { status: 201 }, "Account created");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed";
    const status =
      typeof error === "object" &&
      error &&
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : 400;
    return fail(message, status);
  }
}
