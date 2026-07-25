/**
 * Apply Workspace-class attachment + outbound limits on the local mail host.
 * Idempotent. Safe to run from Orbit health / platform-ensure when MAIL_PROVISION_MODE=local.
 * Does not alter Dovecot auth, MariaDB, or Roundcube IMAP/SMTP host settings.
 */
import { execFile } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PHP_UPLOAD = process.env.ORBIT_PHP_UPLOAD ?? "25M";
const PHP_POST = process.env.ORBIT_PHP_POST ?? "30M";
const NGINX_BODY = process.env.ORBIT_NGINX_BODY ?? "30m";
const MSG_BYTES = process.env.ORBIT_MSG_BYTES ?? "26214400";
const PTR_HOSTNAME =
  process.env.PTR_HOSTNAME?.trim() ||
  process.env.MAIL_HOSTNAME?.trim() ||
  "mail.theglobalorbit.com";
const RC_ROOT = process.env.ORBIT_ROUNDCUBE_ROOT?.trim() || "/var/www/roundcube";

export type PlatformLimitsResult = {
  ok: boolean;
  steps: string[];
  error?: string;
};

function walkDirs(root: string, name: string, out: string[]): void {
  if (!existsSync(root)) return;
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(root, ent);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (ent === name) out.push(full);
      walkDirs(full, name, out);
    }
  }
}

function walkFiles(root: string, fileName: string, out: string[]): void {
  if (!existsSync(root)) return;
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(root, ent);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(full, fileName, out);
    else if (ent === fileName) out.push(full);
  }
}

async function tryExec(bin: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(bin, args, { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

function phpIniSnippet(): string {
  return `; GLOBAL ORBIT MAIL — attachment uploads (Workspace-class)
upload_max_filesize = ${PHP_UPLOAD}
post_max_size = ${PHP_POST}
max_file_uploads = 50
memory_limit = 256M
max_execution_time = 180
max_input_time = 180
file_uploads = On
upload_tmp_dir = /tmp
`;
}

function patchPhpIniContent(content: string): string {
  let next = content;
  if (/^[; ]*upload_max_filesize\s*=/m.test(next)) {
    next = next.replace(
      /^[; ]*upload_max_filesize\s*=.*$/m,
      `upload_max_filesize = ${PHP_UPLOAD}`,
    );
  } else {
    next += `\nupload_max_filesize = ${PHP_UPLOAD}\n`;
  }
  if (/^[; ]*post_max_size\s*=/m.test(next)) {
    next = next.replace(/^[; ]*post_max_size\s*=.*$/m, `post_max_size = ${PHP_POST}`);
  } else {
    next += `post_max_size = ${PHP_POST}\n`;
  }
  return next;
}

function applyPhpLimits(steps: string[]): void {
  if (!existsSync("/etc/php")) {
    steps.push("php: skipped (/etc/php missing)");
    return;
  }
  const confDirs: string[] = [];
  walkDirs("/etc/php", "conf.d", confDirs);
  for (const dir of confDirs) {
    const target = join(dir, "99-orbit-mail-uploads.ini");
    try {
      writeFileSync(target, phpIniSnippet(), "utf8");
      steps.push(`php: wrote ${target}`);
    } catch (error) {
      steps.push(
        `php: write failed ${target} (${error instanceof Error ? error.message : "err"})`,
      );
    }
  }
  const inis: string[] = [];
  walkFiles("/etc/php", "php.ini", inis);
  for (const ini of inis) {
    try {
      const raw = readFileSync(ini, "utf8");
      const patched = patchPhpIniContent(raw);
      if (patched !== raw) {
        writeFileSync(ini, patched, "utf8");
        steps.push(`php: patched ${ini}`);
      }
    } catch {
      steps.push(`php: skip patch ${ini}`);
    }
  }
}

function applyNginxLimits(steps: string[]): void {
  if (!existsSync("/etc/nginx")) {
    steps.push("nginx: skipped");
    return;
  }
  try {
    mkdirSync("/etc/nginx/conf.d", { recursive: true });
  } catch (error) {
    steps.push(
      `nginx: mkdir failed (${error instanceof Error ? error.message : "err"})`,
    );
    return;
  }
  const conf = `/etc/nginx/conf.d/orbit-mail-uploads.conf`;
  try {
    writeFileSync(
      conf,
      `client_max_body_size ${NGINX_BODY};\nclient_body_buffer_size 1m;\nclient_body_timeout 180s;\n`,
      "utf8",
    );
    steps.push(`nginx: wrote ${conf}`);
  } catch (error) {
    steps.push(
      `nginx: write failed (${error instanceof Error ? error.message : "err"})`,
    );
    return;
  }

  // Patch every *.conf that sets a smaller (or any) client_max_body_size
  const confFiles: string[] = [];
  function collectConfs(dir: string): void {
    if (!existsSync(dir)) return;
    for (const ent of readdirSync(dir)) {
      const full = join(dir, ent);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) collectConfs(full);
      else if (ent.endsWith(".conf")) confFiles.push(full);
    }
  }
  collectConfs("/etc/nginx");

  for (const file of confFiles) {
    if (file.includes("orbit-mail-uploads.conf")) continue;
    try {
      let raw = readFileSync(file, "utf8");
      const before = raw;
      if (/client_max_body_size\s+[^;]+;/i.test(raw)) {
        raw = raw.replace(
          /client_max_body_size\s+[^;]+;/gi,
          `client_max_body_size ${NGINX_BODY};`,
        );
      } else if (/server\s*\{/.test(raw)) {
        // Inject into first server block so site-level defaults cannot stay at 1m
        raw = raw.replace(
          /server\s*\{/,
          `server {\n    client_max_body_size ${NGINX_BODY};`,
        );
      }
      if (raw !== before) {
        writeFileSync(file, raw, "utf8");
        steps.push(`nginx: patched ${file}`);
      }
    } catch {
      /* ignore unreadable */
    }
  }
}

function applyRoundcubeLimits(steps: string[]): void {
  if (!existsSync(RC_ROOT)) {
    steps.push("roundcube: skipped (root missing)");
    return;
  }
  const temp = join(RC_ROOT, "temp");
  const logs = join(RC_ROOT, "logs");
  const cfgDir = join(RC_ROOT, "config");
  mkdirSync(temp, { recursive: true });
  mkdirSync(logs, { recursive: true });
  mkdirSync(cfgDir, { recursive: true });
  try {
    chmodSync(temp, 0o775);
    chmodSync(logs, 0o775);
  } catch {
    /* ignore */
  }

  const attachCfg = join(cfgDir, "attachments-mime.inc.php");
  writeFileSync(
    attachCfg,
    `<?php
$config['max_message_size'] = '25M';
$config['temp_dir'] = 'temp/';
$config['force_7bit'] = false;
$config['smtp_helo_host'] = 'mail.globalorbitmail.cloud';
$config['mime_types'] = null;
`,
    "utf8",
  );
  steps.push(`roundcube: wrote ${attachCfg}`);

  const mainCfg = join(cfgDir, "config.inc.php");
  if (existsSync(mainCfg)) {
    const raw = readFileSync(mainCfg, "utf8");
    if (!raw.includes("attachments-mime.inc.php")) {
      writeFileSync(
        mainCfg,
        `${raw.trimEnd()}\ninclude __DIR__ . '/attachments-mime.inc.php';\n`,
        "utf8",
      );
      steps.push("roundcube: included attachments-mime.inc.php");
    }
  }

  // Probe file for operators (safe; no secrets)
  writeFileSync(
    join(temp, "orbit-upload-check.php"),
    `<?php header('Content-Type: text/plain'); echo 'upload_max_filesize='.ini_get('upload_max_filesize').PHP_EOL.'post_max_size='.ini_get('post_max_size').PHP_EOL;`,
    "utf8",
  );
}

/** Install/update mail-agent + apply script under /opt/global-orbit/bin when possible. */
export function installMailAgentBinaries(steps: string[]): void {
  const destDir = "/opt/global-orbit/bin";
  const candidates = [
    join(process.cwd(), "deploy", "vps", "mail-agent.sh"),
    join(process.cwd(), "deploy/vps/mail-agent.sh"),
  ];
  const applyCandidates = [
    join(process.cwd(), "deploy", "vps", "apply-attachment-limits-inline.sh"),
    join(process.cwd(), "deploy/vps/apply-attachment-limits-inline.sh"),
  ];

  const agentSrc = candidates.find((p) => existsSync(p));
  const applySrc = applyCandidates.find((p) => existsSync(p));
  if (!agentSrc && !applySrc) {
    steps.push("bin: no deploy/vps scripts in cwd");
    return;
  }
  try {
    mkdirSync(destDir, { recursive: true });
  } catch {
    steps.push("bin: cannot mkdir /opt/global-orbit/bin (need root)");
    return;
  }
  try {
    if (agentSrc) {
      copyFileSync(agentSrc, join(destDir, "mail-agent.sh"));
      chmodSync(join(destDir, "mail-agent.sh"), 0o755);
      steps.push("bin: installed mail-agent.sh");
    }
    if (applySrc) {
      copyFileSync(applySrc, join(destDir, "apply-attachment-limits-inline.sh"));
      chmodSync(join(destDir, "apply-attachment-limits-inline.sh"), 0o755);
      steps.push("bin: installed apply-attachment-limits-inline.sh");
    }
  } catch (error) {
    steps.push(
      `bin: install failed (${error instanceof Error ? error.message : "error"})`,
    );
  }
}

export async function applyPlatformLimitsLocal(): Promise<PlatformLimitsResult> {
  const steps: string[] = [];
  try {
    installMailAgentBinaries(steps);
    applyPhpLimits(steps);
    applyNginxLimits(steps);
    applyRoundcubeLimits(steps);

    if (existsSync("/usr/sbin/postconf") || existsSync("/usr/bin/postconf")) {
      const postconf = existsSync("/usr/sbin/postconf")
        ? "/usr/sbin/postconf"
        : "postconf";
      await tryExec(postconf, ["-e", `message_size_limit = ${MSG_BYTES}`]);
      await tryExec(postconf, ["-e", "mailbox_size_limit = 0"]);
      await tryExec(postconf, ["-e", `myhostname = ${PTR_HOSTNAME}`]);
      await tryExec(postconf, ["-e", `smtp_helo_name = ${PTR_HOSTNAME}`]);
      await tryExec(postconf, ["-e", "inet_protocols = ipv4"]);
      steps.push("postfix: message_size_limit + ipv4");
      await tryExec("systemctl", ["reload", "postfix"]);
    }

    if (existsSync("/usr/sbin/nginx") || existsSync("/usr/bin/nginx")) {
      const ok = await tryExec("nginx", ["-t"]);
      if (ok) {
        await tryExec("systemctl", ["reload", "nginx"]);
        steps.push("nginx: reloaded");
      } else {
        steps.push("nginx: nginx -t failed (config left in place)");
      }
    }

    for (const svc of ["php8.3-fpm", "php8.2-fpm", "php8.1-fpm", "php-fpm"]) {
      if (await tryExec("systemctl", ["reload", svc])) {
        steps.push(`php-fpm: reloaded ${svc}`);
        break;
      }
    }

    return { ok: true, steps };
  } catch (error) {
    return {
      ok: false,
      steps,
      error: error instanceof Error ? error.message : "platform limits failed",
    };
  }
}
