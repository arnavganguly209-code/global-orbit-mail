/**
 * Debug Roundcube send — prints display_message + folder hits.
 *   RC_USER=... RC_PASS=... node scripts/debug-roundcube-send.mjs
 */
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = (process.env.RC_URL ?? "https://webmail.globalorbitmail.cloud").replace(/\/$/, "");
const USER = process.env.RC_USER ?? "";
const PASS = process.env.RC_PASS ?? "";
const jar = ".tmp-rc-debug.txt";

if (!USER || !PASS) {
  console.error("Set RC_USER RC_PASS");
  process.exit(2);
}
if (existsSync(jar)) unlinkSync(jar);

function curl(args) {
  const out = execFileSync(
    "curl.exe",
    ["-sS", "-L", "-m", "90", "-c", jar, "-b", jar, "-w", "\n__HTTP__%{http_code}", ...args],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  const lines = out.split(/\r?\n/);
  const status = Number((lines.pop() || "").replace("__HTTP__", "")) || 0;
  return { status, body: lines.join("\n") };
}

function token(html) {
  const m =
    html.match(/name=["']_token["']\s+value=["']([^"']+)["']/) ||
    html.match(/"_token"\s*:\s*"([^"]+)"/);
  return m?.[1] || "";
}

const lp = curl([`${BASE}/`]);
const t0 = token(lp.body);
console.log("login_page", lp.status, "token", Boolean(t0));

writeFileSync(
  ".tmp-login.bin",
  new URLSearchParams({
    _token: t0,
    _task: "login",
    _action: "login",
    _timezone: "UTC",
    _url: "",
    _user: USER,
    _pass: PASS,
  }).toString(),
);
const login = curl([
  "-X",
  "POST",
  "-H",
  "Content-Type: application/x-www-form-urlencoded",
  "--data-binary",
  "@.tmp-login.bin",
  `${BASE}/?_task=login&_action=login`,
]);
console.log("login", login.status, "len", login.body.length, "still_login_form", /name="_user"/.test(login.body));

const mail = curl([`${BASE}/?_task=mail`]);
console.log("mail", mail.status, "len", mail.body.length);

const compose = curl([`${BASE}/?_task=mail&_action=compose`]);
const t1 = token(compose.body) || token(mail.body) || t0;
const id =
  compose.body.match(/name=["']_id["']\s+value=["']([^"']+)["']/)?.[1] ||
  compose.body.match(/"_id"\s*:\s*"([^"]+)"/)?.[1] ||
  "";
console.log("compose", compose.status, "token", Boolean(t1), "id", id || "none");

const stamp = Date.now().toString(36);
const subject = `OrbitSMTP ${stamp}`;
writeFileSync(
  ".tmp-send.bin",
  new URLSearchParams({
    _token: t1,
    _task: "mail",
    _action: "send",
    _id: id,
    _from: USER,
    _to: USER,
    _cc: "",
    _bcc: "",
    _replyto: "",
    _followupto: "",
    _subject: subject,
    _message: `Body ${stamp}\n`,
    _is_html: "0",
    _framed: "1",
  }).toString(),
);

const send = curl([
  "-X",
  "POST",
  "-H",
  "Content-Type: application/x-www-form-urlencoded",
  "--data-binary",
  "@.tmp-send.bin",
  `${BASE}/?_task=mail&_action=send`,
]);
writeFileSync(".tmp-rc-send-body.html", send.body);
console.log("send", send.status, "len", send.body.length);

const checks = {
  smtp_no_auth: /SMTP server does not support authentication/i.test(send.body),
  smtp_error: /SMTP Error|smtpautherror|smtpconnerror/i.test(send.body),
  session_error: /session is invalid|session_error/i.test(send.body),
  display_confirm: /display_message\("[^"]*"\s*,\s*"confirmation"/i.test(send.body) || /Message sent successfully/i.test(send.body),
  wrong_version: /wrong version number/i.test(send.body),
};
console.log("checks", checks);

const msgs = [...send.body.matchAll(/display_message\("((?:\\.|[^"\\])*)"\s*,\s*"([^"]*)"/g)].map(
  (m) => ({ text: m[1].replace(/\\"/g, '"'), type: m[2] }),
);
console.log("messages", msgs);

await new Promise((r) => setTimeout(r, 4000));

for (const mbox of ["Sent", "INBOX", "Drafts", "Trash", "Junk"]) {
  const listed = curl([`${BASE}/?_task=mail&_action=list&_mbox=${mbox}&_remote=1`]);
  writeFileSync(`.tmp-rc-${mbox}.json`, listed.body);
  console.log(
    `mbox.${mbox}`,
    "status",
    listed.status,
    "hasStamp",
    listed.body.includes(stamp),
    "sample",
    listed.body.slice(0, 180).replace(/\s+/g, " "),
  );
}

console.log("SUBJECT", subject);
