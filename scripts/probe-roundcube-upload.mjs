import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const BASE = "https://webmail.globalorbitmail.cloud";
const USER = process.env.RC_USER;
const PASS = process.env.RC_PASS;
const jar = ".tmp-up.txt";
if (existsSync(jar)) unlinkSync(jar);

function curl(args) {
  const out = execFileSync(
    "curl.exe",
    ["-sS", "-L", "-m", "90", "-c", jar, "-b", jar, "-w", "\n__HTTP__%{http_code}", ...args],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
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

mkdirSync(".tmp-rc-fixtures", { recursive: true });
const png = join(".tmp-rc-fixtures", "t.png");
writeFileSync(
  png,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const lp = curl([`${BASE}/`]);
const t0 = token(lp.body);
writeFileSync(
  ".tmp-l.bin",
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
  "@.tmp-l.bin",
  `${BASE}/?_task=login&_action=login`,
]);
const compose = curl([`${BASE}/?_task=mail&_action=compose`]);
const t1 = token(compose.body) || t0;
const id =
  (compose.body.match(/name=["']_id["']\s+value=["']([^"']+)["']/) ||
    compose.body.match(/"_id"\s*:\s*"([^"]+)"/) ||
    [])[1] || "";
console.log("id", id, "token", Boolean(t1));

const attempts = [
  [
    "upload_field",
    [
      "-F",
      `_token=${t1}`,
      "-F",
      `_id=${id}`,
      "-F",
      `_upload=@${png};filename=t.png;type=image/png`,
      `${BASE}/?_task=mail&_action=upload`,
    ],
  ],
  [
    "file_remote",
    [
      "-F",
      `_token=${t1}`,
      "-F",
      `_id=${id}`,
      "-F",
      `_file=@${png};filename=t.png;type=image/png`,
      `${BASE}/?_task=mail&_action=upload&_remote=1`,
    ],
  ],
  [
    "attachments_unlock",
    [
      "-F",
      `_token=${t1}`,
      "-F",
      `_id=${id}`,
      "-F",
      `_attachments=@${png};filename=t.png;type=image/png`,
      `${BASE}/?_task=mail&_action=upload&_from=compose&_unlock=1`,
    ],
  ],
  [
    "upload_array",
    [
      "-F",
      `_token=${t1}`,
      "-F",
      `_id=${id}`,
      "-F",
      `_upload[]=@${png};filename=t.png;type=image/png`,
      `${BASE}/?_task=mail&_action=upload&_from=compose`,
    ],
  ],
];

for (const [label, args] of attempts) {
  const r = curl(["-X", "POST", ...args]);
  console.log(`\n=== ${label} status=${r.status} len=${r.body.length}`);
  console.log(r.body.slice(0, 600));
}
