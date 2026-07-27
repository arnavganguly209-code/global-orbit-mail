import { ok, fail } from "@/lib/api/response";
import { getPublicBrandForDomain } from "@/services/webmail/resolve-brand";

export const runtime = "nodejs";

/** Public branding for login / white-label (no auth). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");
    const email = searchParams.get("email");
    let domainName = domain;
    if (!domainName && email?.includes("@")) {
      domainName = email.split("@")[1] || null;
    }
    const brand = await getPublicBrandForDomain(domainName);
    return ok(brand, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load branding";
    return fail(message, 500);
  }
}
