import { cookies } from "next/headers";
import { ok, fail } from "@/lib/api/response";
import { requireWebmailCredentials } from "@/services/webmail/session-store";

export const runtime = "nodejs";

const PREFS_COOKIE = "go_webmail_prefs";

export type WebmailPrefs = {
  theme: "dark" | "light" | "system";
  signature: string;
};

const DEFAULTS: WebmailPrefs = {
  theme: "dark",
  signature: "",
};

function parsePrefs(raw: string | undefined): WebmailPrefs {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<WebmailPrefs>;
    return {
      theme: parsed.theme === "light" || parsed.theme === "system" ? parsed.theme : "dark",
      signature: typeof parsed.signature === "string" ? parsed.signature.slice(0, 4000) : "",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function GET() {
  try {
    await requireWebmailCredentials();
    const jar = await cookies();
    return ok(parsePrefs(jar.get(PREFS_COOKIE)?.value));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return fail(message, status);
  }
}

export async function PUT(request: Request) {
  try {
    await requireWebmailCredentials();
    const body = (await request.json().catch(() => ({}))) as Partial<WebmailPrefs>;
    const jar = await cookies();
    const current = parsePrefs(jar.get(PREFS_COOKIE)?.value);
    const next: WebmailPrefs = {
      theme:
        body.theme === "light" || body.theme === "system" || body.theme === "dark"
          ? body.theme
          : current.theme,
      signature:
        typeof body.signature === "string" ? body.signature.slice(0, 4000) : current.signature,
    };
    jar.set(PREFS_COOKIE, JSON.stringify(next), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return ok(next, undefined, "Settings saved");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return fail(message, status);
  }
}
