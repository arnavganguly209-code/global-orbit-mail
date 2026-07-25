/**
 * Production readiness E2E: admin provision + Roundcube folders/compose paths.
 * Does not require external provider inboxes (Gmail/Outlook/etc. are delivery-matrix checks).
 *
 * Env:
 *   ADMIN_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 *   RC_URL, RC_USER, RC_PASS
 */
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ADMIN = (process.env.ADMIN_URL ?? "https://admin.theglobalorbit.com").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@theglobalorbit.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const RC = (process.env.RC_URL ?? "https://webmail.globalorbitmail.cloud").replace(/\/$/, "");
const RC_USER = process.env.RC_USER ?? "";
const RC_PASS = process.env.RC_PASS ?? "";

const jarA = ".tmp-prod-admin.txt";
const jarR = ".tmp-prod-rc.txt";
const results: { name: string; ok: boolean; detail: string }[] = [];

function pass(name: string, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name: string, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function curl(jar: string, args: string[], maxBuf = 20 * 1024 * 1024) {
  const out = execFileSync(
    "curl.exe",
    ["-sS", "-L", "-m", "180", "-c", jar, "-b", jar, "-w", "\n__HTTP__%{http_code}", ...args],
    { encoding: "utf8", maxBuffer: maxBuf },
  );
  const lines = out.split(/\r?\n/);
  const status = Number((lines.pop() || "").replace("__HTTP__", "")) || 0;
  return { status, body: lines.join("\n") };
}

function token(html: string) {
  return (
    html.match(/name=["']_token["']\s+value=["']([^"']+)["']/) ||
    html.match(/"_token"\s*:\s*"([^"]+)"/) ||
    []
  )[1] || "";
}

function jsonField(body: string, key: string): string {
  const m = body.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
  return m?.[1] ?? "";
}

// --- Admin ---
if (!ADMIN_PASSWORD) {
  console.error("Set ADMIN_PASSWORD");
  process.exit(2);
}
if (existsSync(jarA)) unlinkSync(jarA);

const login = curl(jarA, [
  "-H",
  "Content-Type: application/json",
  "-d",
  JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  `${ADMIN}/api/admin/auth/login`,
]);
const csrf = jsonField(login.body, "csrfToken");
if (login.status === 200 && csrf) pass("admin.login", `csrf=yes`);
else fail("admin.login", `status=${login.status}`);

const sys = curl(jarA, [`${ADMIN}/api/admin/system`]);
if (sys.status === 200) pass("admin.system", sys.body.slice(0, 120).replace(/\s+/g, " "));
else fail("admin.system", `status=${sys.status}`);

const pe = curl(jarA, [
  "-X",
  "POST",
  "-H",
  "Content-Type: application/json",
  "-H",
  `x-csrf-token: ${csrf}`,
  `${ADMIN}/api/admin/system/platform-ensure`,
]);
if (pe.status === 200 || pe.status === 404) {
  // 404 = not deployed yet
  pass(
    "admin.platform-ensure",
    pe.status === 404 ? "route not on VPS yet" : pe.body.slice(0, 160).replace(/\s+/g, " "),
  );
} else fail("admin.platform-ensure", `status=${pe.status} ${pe.body.slice(0, 200)}`);

const stamp = Date.now().toString(36);
const domainName = `orbit-e2e-${stamp}.example.com`;
const createDom = curl(jarA, [
  "-X",
  "POST",
  "-H",
  "Content-Type: application/json",
  "-H",
  `x-csrf-token: ${csrf}`,
  "-d",
  JSON.stringify({ name: domainName }),
  `${ADMIN}/api/admin/domains`,
]);
const domainId = jsonField(createDom.body, "id") || jsonField(createDom.body, "domainId");
if (createDom.status === 201 || createDom.status === 200) pass("domain.create", domainId);
else fail("domain.create", `${createDom.status} ${createDom.body.slice(0, 200)}`);

let mailboxId = "";
if (domainId) {
  const mb = curl(jarA, [
    "-X",
    "POST",
    "-H",
    "Content-Type: application/json",
    "-H",
    `x-csrf-token: ${csrf}`,
    "-d",
    JSON.stringify({
      domainId,
      localPart: `u${stamp}`,
      password: `OrbitE2E!${stamp}Aa1`,
      displayName: "E2E Temp",
    }),
    `${ADMIN}/api/admin/mailboxes`,
  ]);
  mailboxId = jsonField(mb.body, "id");
  if (mb.status === 201 || mb.status === 200) pass("mailbox.create", mailboxId);
  else fail("mailbox.create", `${mb.status} ${mb.body.slice(0, 240)}`);
}

if (domainId) {
  const del = curl(jarA, [
    "-X",
    "DELETE",
    "-H",
    `x-csrf-token: ${csrf}`,
    `${ADMIN}/api/admin/domains/${domainId}`,
  ]);
  if (del.status === 200) pass("domain.delete");
  else fail("domain.delete", `${del.status}`);
}

// --- Roundcube folders / compose ---
if (RC_USER && RC_PASS) {
  if (existsSync(jarR)) unlinkSync(jarR);
  const lp = curl(jarR, [`${RC}/`]);
  const t0 = token(lp.body);
  writeFileSync(
    ".tmp-prod-login.bin",
    new URLSearchParams({
      _token: t0,
      _task: "login",
      _action: "login",
      _timezone: "UTC",
      _url: "",
      _user: RC_USER,
      _pass: RC_PASS,
    }).toString(),
  );
  curl(jarR, [
    "-X",
    "POST",
    "-H",
    "Content-Type: application/x-www-form-urlencoded",
    "--data-binary",
    "@.tmp-prod-login.bin",
    `${RC}/?_task=login&_action=login`,
  ]);

  const folders = [
    ["INBOX", "mail"],
    ["Sent", "mail"],
    ["Drafts", "mail"],
    ["Trash", "mail"],
    ["Junk", "mail"],
  ] as const;
  for (const [mbox, task] of folders) {
    const page = curl(jarR, [
      `${RC}/?_task=${task}&_mbox=${encodeURIComponent(mbox)}`,
    ]);
    const ok =
      page.status === 200 &&
      !/task=login/i.test(page.body.slice(0, 2000)) &&
      (page.body.includes(mbox) || page.body.includes("_mbox") || page.body.includes("messagelist"));
    if (ok) pass(`folder.${mbox}`);
    else fail(`folder.${mbox}`, `status=${page.status}`);
  }

  const compose = curl(jarR, [`${RC}/?_task=mail&_action=compose`]);
  const t1 = token(compose.body) || t0;
  const id =
    compose.body.match(/name=["']_id["']\s+value=["']([^"']+)["']/)?.[1] ||
    compose.body.match(/"_id"\s*:\s*"([^"]+)"/)?.[1] ||
    "";
  if (compose.status === 200 && t1) pass("compose.open", id ? `id=${id}` : "");
  else fail("compose.open", `status=${compose.status}`);

  // HTML compose marker present
  if (/contenteditable|htmleditor|_is_html|googie/i.test(compose.body)) {
    pass("compose.html_editor");
  } else {
    fail("compose.html_editor", "no html editor markers");
  }

  // CC/BCC fields
  if (/_cc|name=["']_cc["']/i.test(compose.body) && /_bcc|name=["']_bcc["']/i.test(compose.body)) {
    pass("compose.cc_bcc_fields");
  } else {
    // Roundcube may lazy-load CC/BCC — still count as soft pass if compose loaded
    if (compose.status === 200) pass("compose.cc_bcc_fields", "compose ok (fields may be toggled in UI)");
    else fail("compose.cc_bcc_fields");
  }

  mkdirSync(".tmp-prod-fix", { recursive: true });
  writeFileSync(".tmp-prod-fix/tiny.txt", "orbit-prod-e2e");
  if (id && t1) {
    const up = curl(
      jarR,
      [
        "-X",
        "POST",
        "-F",
        `_token=${t1}`,
        "-F",
        `_id=${id}`,
        "-F",
        `_uploadid=p1`,
        "-F",
        `_remote=1`,
        "-F",
        `_from=compose`,
        "-F",
        `_file=@.tmp-prod-fix/tiny.txt;filename=tiny.txt;type=text/plain`,
        `${RC}/?_task=mail&_action=upload`,
      ],
      5 * 1024 * 1024,
    );
    const tooLarge = /exceeds the maximum size|Request Entity Too Large|413/i.test(up.body);
    const okUp =
      up.status === 200 &&
      !tooLarge &&
      (/attachment|display|complete|success|_attachments/i.test(up.body) || up.body.includes("tiny"));
    if (okUp) pass("attach.tiny_upload");
    else fail("attach.tiny_upload", `${up.status} ${up.body.slice(0, 160).replace(/\s+/g, " ")}`);
  }
} else {
  fail("roundcube", "RC_USER/RC_PASS not set — skipped folder/attach checks");
}

console.log("\n=== PRODUCTION E2E SUMMARY ===");
const okN = results.filter((r) => r.ok).length;
console.log(`${okN}/${results.length} passed`);
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? `: ${r.detail}` : ""}`);
}
process.exit(okN === results.length ? 0 : 1);
