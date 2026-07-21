/**
 * Browser fetch for admin APIs — attaches CSRF double-submit header.
 * Ensures a CSRF cookie exists before mutations (mints via /api/admin/auth/me if needed).
 */

import { CSRF_COOKIE } from "@/lib/auth/constants";

let memoryCsrfToken: string | null = null;

export function cacheAdminCsrfToken(token: string | null | undefined) {
  if (token && token.trim()) {
    memoryCsrfToken = token.trim();
  }
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.split("=").slice(1).join("=")).trim();
  } catch {
    return match.split("=").slice(1).join("=").trim();
  }
}

async function resolveCsrfToken(): Promise<string | null> {
  const fromCookie = readCookie(CSRF_COOKIE);
  if (fromCookie) {
    memoryCsrfToken = fromCookie;
    return fromCookie;
  }
  if (memoryCsrfToken) return memoryCsrfToken;

  try {
    const res = await fetch("/api/admin/auth/me", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { csrfToken?: string };
      };
      if (json.data?.csrfToken) {
        cacheAdminCsrfToken(json.data.csrfToken);
      }
    }
  } catch {
    // Fall through — mutation will surface Invalid CSRF token if still missing.
  }

  return readCookie(CSRF_COOKIE) ?? memoryCsrfToken;
}

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (method !== "GET" && method !== "HEAD") {
    const csrf = await resolveCsrfToken();
    if (csrf) {
      headers.set("x-csrf-token", csrf);
    }
    if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
  }

  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
