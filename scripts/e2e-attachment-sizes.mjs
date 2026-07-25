/**
 * Roundcube attachment size ladder: 1MB, 5MB, 10MB, 20MB.
 *
 * RC_USER / RC_PASS required.
 * Usage: node scripts/e2e-attachment-sizes.mjs
 */
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const BASE = (process.env.RC_URL ?? "https://webmail.globalorbitmail.cloud").replace(/\/$/, "");
const USER = process.env.RC_USER ?? "";
const PASS = process.env.RC_PASS ?? "";
const jar = ".tmp-size-cookies.txt";
const dir = ".tmp-size-fixtures";

if (!USER || !PASS) {
  console.error("Set RC_USER and RC_PASS");
  process.exit(2);
}

function curl(args) {
  const out = execFileSync(
    "curl.exe",
    ["-sS", "-L", "-m", "300", "-c", jar, "-b", jar, "-w", "\n__HTTP__%{http_code}", ...args],
    { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 },
  );
  const lines = out.split(/\r?\n/);
  const status = Number((lines.pop() || "").replace("__HTTP__", "")) || 0;
  return { status, body: lines.join("\n") };
}
function token(html) {
  return (
    html.match(/name=["']_token["']\s+value=["']([^"']+)["']/) ||
    html.match(/"_token"\s*:\s*"([^"]+)"/) ||
    []
  )[1] || "";
}

if (existsSync(jar)) unlinkSync(jar);
mkdirSync(dir, { recursive: true });

const lp = curl([`${BASE}/`]);
const t0 = token(lp.body);
writeFileSync(
  ".tmp-size-login.bin",
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
curl([
  "-X",
  "POST",
  "-H",
  "Content-Type: application/x-www-form-urlencoded",
  "--data-binary",
  "@.tmp-size-login.bin",
  `${BASE}/?_task=login&_action=login`,
]);

const sizesMb = [1, 5, 10, 20];
const results = [];

for (const mb of sizesMb) {
  const compose = curl([`${BASE}/?_task=mail&_action=compose`]);
  const t1 = token(compose.body) || t0;
  const id =
    compose.body.match(/name=["']_id["']\s+value=["']([^"']+)["']/)?.[1] ||
    compose.body.match(/"_id"\s*:\s*"([^"]+)"/)?.[1] ||
    "";
  const file = join(dir, `orbit-${mb}mb.bin`).replace(/\\/g, "/");
  // Pseudo-random compressible-ish binary of exact size
  const buf = Buffer.alloc(mb * 1024 * 1024, mb);
  writeFileSync(file, buf);

  const up = curl([
    "-X",
    "POST",
    "-F",
    `_token=${t1}`,
    "-F",
    `_id=${id}`,
    "-F",
    `_file=@${file};filename=orbit-${mb}mb.bin;type=application/octet-stream`,
    `${BASE}/?_task=mail&_action=upload&_from=compose&_remote=1`,
  ]);
  const tooLarge = /exceeds the maximum size|filesizeexceedlimit/i.test(up.body);
  const ok =
    up.status === 200 &&
    !tooLarge &&
    (/add2attachment|remove_attachment|attachment/i.test(up.body) ||
      /"exec":"this\./i.test(up.body));
  console.log(
    `${ok ? "PASS" : "FAIL"}  upload_${mb}MB — status=${up.status} tooLarge=${tooLarge} body=${up.body.slice(0, 160).replace(/\s+/g, " ")}`,
  );
  results.push(ok);
  writeFileSync(`.tmp-size-up-${mb}.txt`, up.body.slice(0, 2000));
}

const failed = results.filter((r) => !r).length;
console.log(`\n=== SIZE LADDER ${results.filter(Boolean).length}/${sizesMb.length} passed ===`);
process.exit(failed ? 1 : 0);
