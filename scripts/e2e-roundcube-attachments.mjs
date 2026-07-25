/**
 * Roundcube attachment send probe (multipart compose).
 *
 * RC_USER / RC_PASS required. Optional RC_TO (defaults to self).
 * Creates tiny PNG + PDF + ZIP fixtures and uploads via Roundcube upload+send.
 *
 * Usage:
 *   RC_USER=a@b.com RC_PASS=... node scripts/e2e-roundcube-attachments.mjs
 */
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const BASE = (process.env.RC_URL ?? "https://webmail.globalorbitmail.cloud").replace(/\/$/, "");
const USER = process.env.RC_USER ?? "";
const PASS = process.env.RC_PASS ?? "";
const TO = process.env.RC_TO ?? USER;
const jar = ".tmp-rc-att-cookies.txt";
const fixtureDir = ".tmp-rc-fixtures";

if (!USER || !PASS) {
  console.error("Set RC_USER and RC_PASS");
  process.exit(2);
}

function curl(args) {
  const out = execFileSync(
    "curl.exe",
    ["-sS", "-L", "-m", "180", "-c", jar, "-b", jar, "-w", "\n__HTTP__%{http_code}", ...args],
    { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
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

function record(step, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${step} — ${detail}`);
  return ok;
}

if (existsSync(jar)) unlinkSync(jar);
mkdirSync(fixtureDir, { recursive: true });

// Minimal PNG (1x1)
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const pngPath = join(fixtureDir, "orbit-test.png");
writeFileSync(pngPath, png);

// Minimal PDF
const pdfPath = join(fixtureDir, "orbit-test.pdf");
writeFileSync(
  pdfPath,
  `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>endobj
4 0 obj<< /Length 44 >>stream
BT /F1 12 Tf 50 150 Td (Orbit PDF) Tj ET
endstream endobj
xref
0 5
trailer<< /Size 5 /Root 1 0 R >>
startxref
0
%%EOF
`,
);

// Minimal ZIP (store empty file) — PK signature
const zipPath = join(fixtureDir, "orbit-test.zip");
writeFileSync(
  zipPath,
  Buffer.from([
    0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]),
);

const results = [];

const lp = curl([`${BASE}/`]);
const t0 = token(lp.body);
results.push(record("login_page", lp.status === 200 && Boolean(t0), `token=${Boolean(t0)}`));

writeFileSync(
  ".tmp-att-login.bin",
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
  "@.tmp-att-login.bin",
  `${BASE}/?_task=login&_action=login`,
]);
results.push(record("login", login.status === 200 && !/name="_user"/.test(login.body), `len=${login.body.length}`));

const compose = curl([`${BASE}/?_task=mail&_action=compose`]);
const t1 = token(compose.body) || t0;
const composeId =
  compose.body.match(/name=["']_id["']\s+value=["']([^"']+)["']/)?.[1] ||
  compose.body.match(/"_id"\s*:\s*"([^"]+)"/)?.[1] ||
  "";
results.push(record("compose", Boolean(t1) && Boolean(composeId), `id=${composeId || "none"}`));

# Upload each attachment via Roundcube upload handler (_file + _remote=1)
const uploaded = [];
for (const file of [pngPath, pdfPath, zipPath]) {
  const abs = file.replace(/\\/g, "/");
  const name = abs.split("/").pop() || "file";
  const up = curl([
    "-X",
    "POST",
    "-F",
    `_token=${t1}`,
    "-F",
    `_id=${composeId}`,
    "-F",
    `_file=@${abs};filename=${name};type=application/octet-stream`,
    `${BASE}/?_task=mail&_action=upload&_from=compose&_remote=1`,
  ]);
  const tooLarge = /exceeds the maximum size|filesizeexceedlimit/i.test(up.body);
  const ok =
    up.status === 200 &&
    !tooLarge &&
    !/error|denied/i.test(up.body) &&
    (/attachment|add2attachment|remove_attachment|display_message\("[^"]*"\s*,\s*"confirmation"/i.test(
      up.body,
    ) ||
      /"exec":"this\./i.test(up.body));
  results.push(
    record(
      `upload.${name}`,
      ok,
      `status=${up.status} tooLarge=${tooLarge} len=${up.body.length} body=${up.body.slice(0, 120).replace(/\s+/g, " ")}`,
    ),
  );
  writeFileSync(`.tmp-att-upload-${name}.txt`, up.body.slice(0, 2000));
  if (ok) uploaded.push(name);
}

const stamp = Date.now().toString(36);
const kinds = [
  {
    label: "plain",
    subject: `Orbit plain ${stamp}`,
    html: "0",
    message: `Plain text body ${stamp}\n`,
  },
  {
    label: "html",
    subject: `Orbit html ${stamp}`,
    html: "1",
    message: `<p><b>HTML</b> body ${stamp}</p>`,
  },
];

for (const kind of kinds) {
  const c = curl([`${BASE}/?_task=mail&_action=compose`]);
  const tok = token(c.body) || t1;
  const cid =
    c.body.match(/name=["']_id["']\s+value=["']([^"']+)["']/)?.[1] ||
    c.body.match(/"_id"\s*:\s*"([^"]+)"/)?.[1] ||
    "";
  const params = new URLSearchParams({
    _token: tok,
    _task: "mail",
    _action: "send",
    _id: cid,
    _from: USER,
    _to: TO,
    _subject: kind.subject,
    _message: kind.message,
    _is_html: kind.html,
    _framed: "1",
  });
  writeFileSync(".tmp-att-send.bin", params.toString());
  const send = curl([
    "-X",
    "POST",
    "-H",
    "Content-Type: application/x-www-form-urlencoded",
    "--data-binary",
    "@.tmp-att-send.bin",
    `${BASE}/?_task=mail&_action=send`,
  ]);
  const confirm =
    /display_message\("[^"]*"\s*,\s*"confirmation"/i.test(send.body) ||
    /Message sent successfully/i.test(send.body);
  const smtpFail = /SMTP Error|Connection to server failed|does not support authentication/i.test(
    send.body,
  );
  results.push(
    record(`send.${kind.label}`, confirm && !smtpFail, `confirm=${confirm} smtpFail=${smtpFail}`),
  );
  writeFileSync(`.tmp-att-send-${kind.label}.html`, send.body.slice(0, 4000));
}

// Fresh compose + all attachments for combined send
const compose2 = curl([`${BASE}/?_task=mail&_action=compose`]);
const t2 = token(compose2.body) || t1;
const id2 =
  compose2.body.match(/name=["']_id["']\s+value=["']([^"']+)["']/)?.[1] ||
  compose2.body.match(/"_id"\s*:\s*"([^"]+)"/)?.[1] ||
  "";
for (const file of [pngPath, pdfPath, zipPath]) {
  curl([
    "-X",
    "POST",
    "-F",
    `_token=${t2}`,
    "-F",
    `_id=${id2}`,
    "-F",
    `_upload=@${file}`,
    `${BASE}/?_task=mail&_action=upload&_remote=1`,
  ]);
}
const attSubject = `Orbit attachments ${stamp}`;
writeFileSync(
  ".tmp-att-send-all.bin",
  new URLSearchParams({
    _token: t2,
    _task: "mail",
    _action: "send",
    _id: id2,
    _from: USER,
    _to: TO,
    _subject: attSubject,
    _message: `Attachments PNG+PDF+ZIP ${stamp}\n`,
    _is_html: "0",
    _framed: "1",
  }).toString(),
);
const sendAtt = curl([
  "-X",
  "POST",
  "-H",
  "Content-Type: application/x-www-form-urlencoded",
  "--data-binary",
  "@.tmp-att-send-all.bin",
  `${BASE}/?_task=mail&_action=send`,
]);
const attConfirm =
  /display_message\("[^"]*"\s*,\s*"confirmation"/i.test(sendAtt.body) ||
  /Message sent successfully/i.test(sendAtt.body);
const attFail = /SMTP Error|too large|exceed|Connection to server failed/i.test(sendAtt.body);
results.push(record("send.attachments", attConfirm && !attFail, `confirm=${attConfirm} fail=${attFail}`));
writeFileSync(".tmp-att-send-all.html", sendAtt.body.slice(0, 4000));

await new Promise((r) => setTimeout(r, 3000));
for (const mbox of ["Sent", "INBOX", "Drafts", "Trash", "Junk"]) {
  const listed = curl([`${BASE}/?_task=mail&_action=list&_mbox=${mbox}&_remote=1`]);
  results.push(
    record(
      `folder.${mbox}`,
      listed.status === 200,
      `hasStamp=${listed.body.includes(stamp)} status=${listed.status}`,
    ),
  );
}

console.log("\n=== ATTACHMENT E2E SUMMARY ===");
console.log(`uploaded=${uploaded.join(",") || "none"} stamp=${stamp}`);
process.exit(results.every(Boolean) ? 0 : 1);
