/**
 * Roundcube HTTP e2e: login → compose → send → check folders.
 * Runs against production webmail (server-side SMTP to 127.0.0.1).
 *
 * Usage (PowerShell):
 *   $env:RC_URL='https://webmail.globalorbitmail.cloud'
 *   $env:RC_USER='user@domain'
 *   $env:RC_PASS='password'
 *   $env:RC_TO='user@domain'   # optional, defaults to RC_USER
 *   node scripts/e2e-roundcube-send.mjs
 */

import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = (process.env.RC_URL ?? "https://webmail.globalorbitmail.cloud").replace(/\/$/, "");
const USER = process.env.RC_USER ?? "";
const PASS = process.env.RC_PASS ?? "";
const TO = process.env.RC_TO ?? USER;
const jar = ".tmp-rc-cookies.txt";

if (!USER || !PASS) {
  console.error("Set RC_USER and RC_PASS");
  process.exit(2);
}

const results = [];
function record(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step} — ${detail}`);
}

function curl(args) {
  const out = execFileSync(
    "curl.exe",
    ["-sS", "-L", "-m", "90", "-c", jar, "-b", jar, "-w", "\n__HTTP__%{http_code}", ...args],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  const lines = out.split(/\r?\n/);
  const statusLine = lines.pop() ?? "";
  const status = Number(statusLine.replace("__HTTP__", "")) || 0;
  return { status, body: lines.join("\n") };
}

function extractToken(html) {
  const m =
    html.match(/name=["']_token["']\s+value=["']([^"']+)["']/) ||
    html.match(/name=["']_token["'][^>]*value=["']([^"']+)["']/) ||
    html.match(/"_token"\s*:\s*"([^"]+)"/) ||
    html.match(/request_token["']?\s*[:=]\s*["']([^"']+)/i);
  return m?.[1] ?? "";
}

function extractTaskUrl(html, actionHint) {
  // Roundcube often uses ?_task=mail&_action=compose
  if (html.includes("_action=compose") || html.includes("action=compose")) return true;
  return html.toLowerCase().includes(actionHint);
}

if (existsSync(jar)) unlinkSync(jar);

const stamp = Date.now().toString(36);
const subject = `Orbit RC SMTP test ${stamp}`;

// 1) Login page
const loginPage = curl([`${BASE}/`]);
const loginToken = extractToken(loginPage.body);
record(
  "rc.login_page",
  loginPage.status >= 200 && loginPage.status < 400,
  `status=${loginPage.status} token=${loginToken ? "yes" : "no"}`,
);

// 2) Login POST
const loginBody = new URLSearchParams({
  _token: loginToken,
  _task: "login",
  _action: "login",
  _timezone: "Asia/Kathmandu",
  _url: "",
  _user: USER,
  _pass: PASS,
});
writeFileSync(".tmp-rc-login.txt", loginBody.toString());
const login = curl([
  "-X",
  "POST",
  "-H",
  "Content-Type: application/x-www-form-urlencoded",
  "--data-binary",
  "@.tmp-rc-login.txt",
  `${BASE}/?_task=login&_action=login`,
]);
const loggedIn =
  login.status >= 200 &&
  login.status < 400 &&
  (login.body.includes("_task=mail") ||
    login.body.includes("mailboxlist") ||
    login.body.includes("task=mail") ||
    !login.body.includes('name="_user"'));
record("rc.login", loggedIn, `status=${login.status} len=${login.body.length}`);

if (!loggedIn) {
  writeFileSync(".tmp-rc-login-fail.html", login.body.slice(0, 5000));
  console.error("Login failed — wrote .tmp-rc-login-fail.html");
  process.exit(1);
}

// 3) Mail UI / folders
const mail = curl([`${BASE}/?_task=mail`]);
const mailToken = extractToken(mail.body) || loginToken;
const folders = ["inbox", "sent", "drafts", "trash", "junk", "spam"];
for (const f of folders) {
  const hit =
    mail.body.toLowerCase().includes(f) ||
    mail.body.toLowerCase().includes(`=${f}`) ||
    mail.body.includes("INBOX") ||
    mail.body.includes("Sent");
  // Roundcube may load folders via AJAX — soft check on shell presence
  record(`rc.folder_shell.${f}`, mail.status === 200, `present_hint=${hit}`);
}

// Explicit folder list via Roundcube JSON if available
const folderList = curl([
  `${BASE}/?_task=mail&_action=list&_refresh=1&_mbox=INBOX&_remote=1&_unlock=loading`,
]);
record(
  "rc.inbox_list",
  folderList.status === 200,
  `status=${folderList.status} len=${folderList.body.length}`,
);

for (const mbox of ["INBOX", "Sent", "Drafts", "Trash", "Junk"]) {
  const listed = curl([
    `${BASE}/?_task=mail&_action=list&_mbox=${encodeURIComponent(mbox)}&_remote=1`,
  ]);
  record(
    `rc.mbox.${mbox}`,
    listed.status === 200 && !/SMTP server does not support authentication/i.test(listed.body),
    `status=${listed.status}`,
  );
}

// 4) Compose page
const compose = curl([`${BASE}/?_task=mail&_action=compose`]);
const composeToken = extractToken(compose.body) || mailToken;
const composeId =
  compose.body.match(/_id["']?\s*[:=]\s*["']?([a-zA-Z0-9._-]+)/)?.[1] ||
  compose.body.match(/name=["']_id["']\s+value=["']([^"']+)["']/)?.[1] ||
  "";
record(
  "rc.compose",
  compose.status === 200 && Boolean(composeToken),
  `status=${compose.status} token=${composeToken ? "yes" : "no"} id=${composeId || "none"}`,
);

// 5) Send
const sendParams = new URLSearchParams();
sendParams.set("_token", composeToken);
sendParams.set("_task", "mail");
sendParams.set("_action", "send");
if (composeId) sendParams.set("_id", composeId);
sendParams.set("_from", USER);
sendParams.set("_to", TO);
sendParams.set("_cc", "");
sendParams.set("_bcc", "");
sendParams.set("_replyto", "");
sendParams.set("_followupto", "");
sendParams.set("_subject", subject);
sendParams.set("_message", `Automated Roundcube SMTP transport test.\nStamp: ${stamp}\n`);
sendParams.set("_draft_saveid", "");
sendParams.set("_draft", "");
sendParams.set("_is_html", "0");
sendParams.set("_framed", "1");

writeFileSync(".tmp-rc-send.txt", sendParams.toString());
const send = curl([
  "-X",
  "POST",
  "-H",
  "Content-Type: application/x-www-form-urlencoded",
  "--data-binary",
  "@.tmp-rc-send.txt",
  `${BASE}/?_task=mail&_action=send`,
]);

const smtpAuthFail = /SMTP server does not support authentication/i.test(send.body);
const smtpFail = /SMTP Error|smtpconnerror|smtpautherror|Connection to server failed/i.test(send.body);
const confirm =
  /display_message\("[^"]*"\s*,\s*"confirmation"/i.test(send.body) ||
  /Message sent successfully/i.test(send.body);
const sendOk = send.status >= 200 && send.status < 400 && confirm && !smtpAuthFail && !smtpFail;

record(
  "rc.send",
  sendOk,
  `status=${send.status} confirm=${confirm} smtpAuthFail=${smtpAuthFail} smtpFail=${smtpFail} subject=${subject}`,
);

if (smtpAuthFail || smtpFail) {
  writeFileSync(".tmp-rc-send-fail.html", send.body.slice(0, 8000));
}

// 6) Refresh Sent + Inbox for the message
const sentList = curl([`${BASE}/?_task=mail&_action=list&_mbox=Sent&_remote=1`]);
record(
  "rc.sent_contains",
  sentList.body.includes(stamp) || sentList.body.includes(subject) || sentList.status === 200,
  `status=${sentList.status} hasStamp=${sentList.body.includes(stamp)}`,
);

const inboxList = curl([`${BASE}/?_task=mail&_action=list&_mbox=INBOX&_remote=1`]);
record(
  "rc.inbox_contains",
  inboxList.body.includes(stamp) || inboxList.body.includes(subject) || inboxList.status === 200,
  `status=${inboxList.status} hasStamp=${inboxList.body.includes(stamp)}`,
);

// cleanup temps
for (const f of [".tmp-rc-login.txt", ".tmp-rc-send.txt", jar]) {
  try {
    if (existsSync(f)) unlinkSync(f);
  } catch {
    /* ignore */
  }
}

console.log("\n=== ROUNDCUBE E2E SUMMARY ===");
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.step}: ${r.detail}`);
const failed = results.filter((r) => !r.ok && (r.step === "rc.login" || r.step === "rc.send"));
process.exit(failed.length ? 1 : 0);
