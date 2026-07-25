/**
 * Admin API e2e smoke for Orbit control plane (Postgres + provision API).
 * Does NOT prove Roundcube/Dovecot MariaDB without VPS deploy.
 *
 * Usage:
 *   ADMIN_URL=https://admin.theglobalorbit.com \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *   npx tsx scripts/e2e-admin-mail-flow.ts
 */

import { writeFileSync, unlinkSync, existsSync } from "node:fs";

const BASE = (process.env.ADMIN_URL ?? "https://admin.theglobalorbit.com").replace(/\/$/, "");
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@theglobalorbit.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

if (!PASSWORD) {
  console.error("Set ADMIN_PASSWORD");
  process.exit(2);
}

const jar = ".tmp-e2e-cookies.txt";
const results: { step: string; ok: boolean; detail: string }[] = [];

function record(step: string, ok: boolean, detail: string) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step} — ${detail}`);
}

async function req(
  method: string,
  path: string,
  body?: unknown,
  csrf?: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // @ts-expect-error undici cookie jar via file not available — use cookie header from login
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

// Node fetch doesn't share curl cookie jar — use curl for session
import { execFileSync } from "node:child_process";

function curlJson(
  method: string,
  path: string,
  body?: unknown,
  csrf?: string,
): { status: number; json: Record<string, unknown> } {
  const args = [
    "-sS",
    "-m",
    "120",
    "-c",
    jar,
    "-b",
    jar,
    "-w",
    "\n__HTTP__%{http_code}",
    "-X",
    method,
    `${BASE}${path}`,
  ];
  if (body !== undefined) {
    const tmp = ".tmp-e2e-body.json";
    writeFileSync(tmp, JSON.stringify(body));
    args.push("-H", "Content-Type: application/json", "--data-binary", `@${tmp}`);
  }
  if (csrf) args.push("-H", `x-csrf-token: ${csrf}`);
  const out = execFileSync("curl.exe", args, { encoding: "utf8" });
  const lines = out.split(/\r?\n/);
  const statusLine = lines.pop() ?? "";
  const status = Number(statusLine.replace("__HTTP__", "")) || 0;
  const bodyText = lines.join("\n");
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    json = { raw: bodyText.slice(0, 300) };
  }
  return { status, json };
}

function main() {
  if (existsSync(jar)) unlinkSync(jar);
  const stamp = Date.now().toString(36);
  const testDomain = `orbit-e2e-${stamp}.example.com`;
  const localPart = `u${stamp}`;
  const mailboxPassword = `OrbitE2e!${stamp.slice(-4)}Aa1`;

  const login = curlJson("POST", "/api/admin/auth/login", {
    email: EMAIL,
    password: PASSWORD,
  });
  const loginOk = login.status === 200 && login.json.success === true;
  const data = (login.json.data ?? {}) as Record<string, unknown>;
  const csrf = String(data.csrfToken ?? "");
  record("admin.login", loginOk, `status=${login.status}`);
  if (!loginOk || !csrf) {
    printSummary();
    process.exit(1);
  }

  const system = curlJson("GET", "/api/admin/system");
  const sysData = (system.json.data ?? {}) as Record<string, unknown>;
  record(
    "admin.system",
    system.status === 200,
    `provisionMode=${sysData.provisionMode ?? "?"}`,
  );

  const domainCreate = curlJson(
    "POST",
    "/api/admin/domains",
    { name: testDomain },
    csrf,
  );
  const domainOk = domainCreate.status === 200 || domainCreate.status === 201;
  const domainPayload = (domainCreate.json.data ?? {}) as Record<string, unknown>;
  // created() may nest differently
  const nested = domainPayload as {
    id?: string;
    domain?: { id?: string };
  };
  const domainId = String(nested.id ?? nested.domain?.id ?? "");
  record(
    "domain.create",
    domainOk && Boolean(domainId),
    `status=${domainCreate.status} id=${domainId || "none"} msg=${String(domainCreate.json.message ?? "")}`,
  );

  let mailboxId = "";
  if (domainId) {
    const mb = curlJson(
      "POST",
      "/api/admin/mailboxes",
      {
        localPart,
        domainId,
        displayName: "E2E Test",
        quotaMb: 512,
        password: mailboxPassword,
      },
      csrf,
    );
    const mbData = (mb.json.data ?? {}) as { id?: string };
    mailboxId = String(mbData.id ?? "");
    record(
      "mailbox.create",
      (mb.status === 200 || mb.status === 201) && Boolean(mailboxId),
      `status=${mb.status} id=${mailboxId || "none"} msg=${String(mb.json.message ?? "")}`,
    );
  } else {
    record("mailbox.create", false, "skipped — no domainId");
  }

  if (mailboxId) {
    const reset = curlJson(
      "POST",
      `/api/admin/mailboxes/${mailboxId}/reset-password`,
      { password: `${mailboxPassword}X`, generate: false },
      csrf,
    );
    record("mailbox.password_reset", reset.status === 200, `status=${reset.status}`);

    const suspend = curlJson(
      "PUT",
      `/api/admin/mailboxes/${mailboxId}`,
      { action: "suspend" },
      csrf,
    );
    record(
      "mailbox.suspend",
      suspend.status === 200,
      `status=${suspend.status} msg=${String(suspend.json.message ?? "")}`,
    );

    const unsuspend = curlJson(
      "PUT",
      `/api/admin/mailboxes/${mailboxId}`,
      { action: "activate" },
      csrf,
    );
    record("mailbox.unsuspend", unsuspend.status === 200, `status=${unsuspend.status}`);

    const del = curlJson("DELETE", `/api/admin/mailboxes/${mailboxId}`, undefined, csrf);
    record("mailbox.delete", del.status === 200, `status=${del.status}`);

    const restore = curlJson(
      "POST",
      "/api/admin/mailboxes",
      {
        localPart,
        domainId,
        displayName: "E2E Restored",
        quotaMb: 512,
        password: mailboxPassword,
      },
      csrf,
    );
    const restoreData = (restore.json.data ?? {}) as { id?: string };
    const restoredId = String(restoreData.id ?? "");
    record(
      "mailbox.restore",
      (restore.status === 200 || restore.status === 201) && Boolean(restoredId),
      `status=${restore.status} id=${restoredId || "none"} msg=${String(restore.json.message ?? "")}`,
    );

    if (restoredId) {
      curlJson("DELETE", `/api/admin/mailboxes/${restoredId}`, undefined, csrf);
    }
  }

  if (domainId) {
    const dd = curlJson("DELETE", `/api/admin/domains/${domainId}`, undefined, csrf);
    record("domain.delete", dd.status === 200, `status=${dd.status}`);
  }

  const diagnose = curlJson(
    "GET",
    "/api/admin/mailboxes/a7793174-041f-4134-a95b-e689919d5fc7/diagnose-auth",
  );
  record(
    "diagnose-auth.route",
    diagnose.status !== 404,
    `status=${diagnose.status} (404 means new code not deployed on VPS)`,
  );

  printSummary();
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  console.log("\n=== E2E SUMMARY ===");
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.step}: ${r.detail}`);
  }
}

main();
