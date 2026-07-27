#!/usr/bin/env bash
# GLOBAL ORBIT MAIL — Fix Roundcube send ("Failed to reach the server!")
# Run ON the mail VPS as root. Uses production logs — does not guess blindly.
#
# Root-cause class (post harden-deliverability):
#   - OpenDKIM milter pointed at :8891 but daemon down/hung → SMTP stalls → PHP/AJAX timeout
#   - smtpd_sender_login_maps = static: (invalid)
#   - Roundcube smtp_host missing / wrong / TLS verify on loopback
#
# Proven working transport: ssl://127.0.0.1:465 + smtp_user=%u + smtp_pass=%p
#
# Usage:
#   bash deploy/vps/fix-roundcube-send.sh
#   RC_USER=you@domain.com RC_PASS='…' bash deploy/vps/fix-roundcube-send.sh
#
set -euo pipefail

RC_ROOT="${ORBIT_ROUNDCUBE_ROOT:-/var/www/roundcube}"
CFG="${RC_ROOT}/config/config.inc.php"
SMTP_INC="${RC_ROOT}/config/smtp-transport.inc.php"
PUBLIC_MX="${PUBLIC_MX:-mail.globalorbitmail.cloud}"
PTR_HOSTNAME="${PTR_HOSTNAME:-$(dig -x 200.97.170.235 +short 2>/dev/null | sed 's/\.$//' | head -n1)}"
PTR_HOSTNAME="${PTR_HOSTNAME:-mail.theglobalorbit.com}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=============================================="
echo " FIX Roundcube → SMTP → Gmail"
echo "=============================================="

echo
echo "==> [1/12] Production logs (last errors)"
tail -n 80 /var/log/mail.log 2>/dev/null | grep -Ei 'error|fatal|warning|milter|sasl|reject|timeout|opendkim' | tail -n 40 || true
journalctl -u postfix -n 40 --no-pager 2>/dev/null || true
if [[ -f "${RC_ROOT}/logs/errors.log" ]]; then
  echo "--- roundcube errors.log ---"
  tail -n 40 "${RC_ROOT}/logs/errors.log" || true
fi
if [[ -f "${RC_ROOT}/logs/smtp" ]]; then
  echo "--- roundcube logs/smtp ---"
  tail -n 40 "${RC_ROOT}/logs/smtp" || true
fi

echo
echo "==> [2/12] Listening ports (Postfix)"
ss -tlnp 2>/dev/null | grep -E ':25 |:465 |:587 ' || netstat -tlnp 2>/dev/null | grep -E ':25 |:465 |:587 ' || true
postconf -n 2>/dev/null | grep -Ei 'myhostname|smtp_helo|inet_protocols|smtpd_tls|smtpd_milters|non_smtpd_milters|milter_|smtpd_relay|smtpd_recipient|smtpd_sender|mynetworks|message_size' || true

echo
echo "==> [3/12] Remove known-bad Postfix settings from deliverability harden"
# Empty static: map is invalid / confusing
postconf -X smtpd_sender_login_maps 2>/dev/null || postconf -e "smtpd_sender_login_maps =" || true

# Authenticated submission must not stall on DNSBL-style checks after permit
# Keep open-relay closed, drop hanging unknown_* after auth path clarity
postconf -e "smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, defer_unauth_destination"
postconf -e "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination"
postconf -e "smtpd_sender_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_non_fqdn_sender"
postconf -e "mynetworks = 127.0.0.0/8 [::1]/128"
postconf -e "smtpd_helo_required = yes"

# Identity / Gmail IPv4
postconf -e "myhostname = ${PTR_HOSTNAME}"
postconf -e "smtp_helo_name = ${PTR_HOSTNAME}"
postconf -e "inet_protocols = ipv4"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtpd_tls_security_level = may"
postconf -e "always_add_missing_headers = yes"
postconf -e "message_size_limit = 26214400"

echo
echo "==> [4/12] OpenDKIM milter — only if actually listening"
MILTER_OK=0
if ss -tlnp 2>/dev/null | grep -q ':8891 '; then
  MILTER_OK=1
elif netstat -tlnp 2>/dev/null | grep -q ':8891 '; then
  MILTER_OK=1
fi

if [[ "$MILTER_OK" -eq 1 ]] && { command -v opendkim >/dev/null 2>&1 || systemctl is-active --quiet opendkim 2>/dev/null; }; then
  postconf -e "smtpd_milters = inet:127.0.0.1:8891"
  postconf -e "non_smtpd_milters = inet:127.0.0.1:8891"
  postconf -e "milter_default_action = accept"
  postconf -e "milter_connect_timeout = 5s"
  postconf -e "milter_command_timeout = 10s"
  postconf -e "milter_content_timeout = 30s"
  echo "    OpenDKIM listening — milters kept (short timeouts)"
else
  # CRITICAL: hung milter → Roundcube AJAX "Failed to reach the server!"
  postconf -e "smtpd_milters ="
  postconf -e "non_smtpd_milters ="
  echo "    WARN: OpenDKIM not listening on :8891 — milters CLEARED to restore send"
  echo "    Install/start OpenDKIM later, then re-enable milters."
fi

echo
echo "==> [5/12] Ensure SMTPS (465) + submission (587) in master.cf"
MASTER_CF="/etc/postfix/master.cf"
if [[ -f "$MASTER_CF" ]]; then
  cp -a "$MASTER_CF" "${MASTER_CF}.bak.orbit-send.$(date +%Y%m%d%H%M%S)"
  # Uncomment smtps / submission if present but commented
  sed -i -E 's/^#\s*(smtps\s+inet\b)/\1/' "$MASTER_CF" || true
  sed -i -E 's/^#\s*(submission\s+inet\b)/\1/' "$MASTER_CF" || true
  if ! grep -qE '^smtps\s+inet' "$MASTER_CF"; then
    cat >> "$MASTER_CF" <<'EOF'

# GLOBAL ORBIT MAIL — SMTPS (Roundcube ssl://127.0.0.1:465)
smtps     inet  n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=no
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o smtpd_relay_restrictions=permit_sasl_authenticated,defer_unauth_destination
EOF
    echo "    appended smtps service"
  fi
  if ! grep -qE '^submission\s+inet' "$MASTER_CF"; then
    cat >> "$MASTER_CF" <<'EOF'

# GLOBAL ORBIT MAIL — submission STARTTLS
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o smtpd_relay_restrictions=permit_sasl_authenticated,defer_unauth_destination
EOF
    echo "    appended submission service"
  fi
fi

# TLS certs if present
if [[ -f "/etc/letsencrypt/live/${PUBLIC_MX}/fullchain.pem" ]]; then
  postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/${PUBLIC_MX}/fullchain.pem"
  postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/${PUBLIC_MX}/privkey.pem"
elif [[ -f "/etc/letsencrypt/live/${PTR_HOSTNAME}/fullchain.pem" ]]; then
  postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/${PTR_HOSTNAME}/fullchain.pem"
  postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/${PTR_HOSTNAME}/privkey.pem"
fi

echo
echo "==> [6/12] Reload Postfix"
postfix check 2>&1 | tail -n 20 || true
systemctl reload postfix 2>/dev/null || systemctl restart postfix
sleep 1
ss -tlnp 2>/dev/null | grep -E ':25 |:465 |:587 ' || true

echo
echo "==> [7/12] Restore Roundcube smtp-transport (ssl://127.0.0.1:465)"
if [[ ! -f "$CFG" ]]; then
  echo "ERROR: missing $CFG" >&2
  exit 1
fi
cp -a "$CFG" "${CFG}.bak.sendfix.$(date +%Y%m%d%H%M%S)"

if [[ -f "${REPO_ROOT}/roundcube/config/smtp-transport.inc.php" ]]; then
  cp -a "${REPO_ROOT}/roundcube/config/smtp-transport.inc.php" "$SMTP_INC"
else
  cat > "$SMTP_INC" <<'PHP'
<?php
$config['smtp_host'] = 'ssl://127.0.0.1:465';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['smtp_auth_type'] = 'PLAIN';
$config['smtp_conn_options'] = [
  'ssl' => [
    'verify_peer' => false,
    'verify_peer_name' => false,
    'peer_name' => 'mail.globalorbitmail.cloud',
    'allow_self_signed' => true,
  ],
];
$config['smtp_timeout'] = 60;
$config['smtp_log'] = true;
$config['smtp_debug'] = true;
PHP
fi

# Force PLAIN — production Postfix advertises PLAIN only (LOGIN → 535)
python3 - <<'PY' "$SMTP_INC"
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8", errors="replace")
if "smtp_timeout" not in text:
    text = text.rstrip() + "\n$config['smtp_timeout'] = 60;\n"
if "allow_self_signed" not in text:
    text = text.replace(
        "'peer_name'         => 'mail.globalorbitmail.cloud',",
        "'peer_name'         => 'mail.globalorbitmail.cloud',\n    'allow_self_signed' => true,",
    )
if re.search(r"\$config\['smtp_auth_type'\]", text):
    text = re.sub(
        r"\$config\['smtp_auth_type'\]\s*=\s*[^;]+;",
        "$config['smtp_auth_type'] = 'PLAIN';",
        text,
    )
else:
    text = text.rstrip() + "\n$config['smtp_auth_type'] = 'PLAIN';\n"
p.write_text(text, encoding="utf-8")
print("smtp-transport forced AUTH PLAIN:", p)
PY

python3 - <<'PY' "$CFG"
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()
for key in ("smtp_server", "smtp_port", "smtp_host", "smtp_user", "smtp_pass"):
    text = re.sub(
        rf"(?m)^(\s*)(\$config\[['\"]{key}['\"]\]\s*=)",
        rf"\1// ORBIT-SMTP-OVERRIDE — \2",
        text,
    )
# Ensure include is LAST so it wins over deliverability/attachments
needle = "include __DIR__ . '/smtp-transport.inc.php';"
text = text.replace(needle, "")
text = text.rstrip() + f"\n\n// GLOBAL ORBIT — SMTP transport MUST be last\n{needle}\n"
open(path, "w", encoding="utf-8").write(text)
print("config.inc.php: smtp-transport include forced last")
PY

php -l "$CFG"
php -l "$SMTP_INC"
chown www-data:www-data "$SMTP_INC" 2>/dev/null || true
chmod 640 "$SMTP_INC"

# Raise PHP timeouts so SMTP cannot trip AJAX "Failed to reach the server"
if [[ -d /etc/php ]]; then
  while IFS= read -r conf_dir; do
    [[ -z "$conf_dir" || ! -d "$conf_dir" ]] && continue
    cat > "${conf_dir}/98-orbit-smtp-timeouts.ini" <<'EOF'
max_execution_time = 120
max_input_time = 120
default_socket_timeout = 60
EOF
  done < <(find /etc/php -type d -name conf.d 2>/dev/null)
fi

echo
echo "==> [8/12] Nginx fastcgi timeouts (AJAX send)"
if [[ -d /etc/nginx ]]; then
  cat > /etc/nginx/conf.d/orbit-roundcube-timeouts.conf <<'EOF'
# GLOBAL ORBIT MAIL — prevent Roundcube "Failed to reach the server!" on SMTP
proxy_read_timeout 120s;
proxy_send_timeout 120s;
fastcgi_read_timeout 120s;
fastcgi_send_timeout 120s;
EOF
  nginx -t && systemctl reload nginx || true
fi

echo
echo "==> [9/12] Reload PHP-FPM + clear Roundcube cache"
rm -rf "${RC_ROOT}/temp/cache" "${RC_ROOT}/temp/cache_"* 2>/dev/null || true
systemctl reload php8.3-fpm 2>/dev/null || systemctl reload php8.2-fpm 2>/dev/null || systemctl reload php8.1-fpm 2>/dev/null || true

echo
echo "==> [10/12] PHP → ssl://127.0.0.1:465 probe"
php -r '
$ctx = stream_context_create(["ssl"=>[
  "verify_peer"=>false,"verify_peer_name"=>false,
  "peer_name"=>"mail.globalorbitmail.cloud","allow_self_signed"=>true
]]);
$fp = @stream_socket_client("ssl://127.0.0.1:465", $e, $s, 15, STREAM_CLIENT_CONNECT, $ctx);
if (!$fp) { fwrite(STDERR, "FAIL ssl://127.0.0.1:465: $s ($e)\n"); exit(1); }
$banner = fgets($fp);
echo "OK banner: $banner";
fwrite($fp, "EHLO orbit-fix.local\r\n");
$caps="";
while (!feof($fp)) { $line=fgets($fp); $caps.=$line; if (isset($line[3]) && $line[3]===" ") break; }
echo $caps;
if (stripos($caps, "AUTH") === false) { fwrite(STDERR, "FAIL: AUTH missing on 465\n"); exit(1); }
fwrite($fp, "QUIT\r\n"); fclose($fp);
echo "PASS: AUTH present on ssl://127.0.0.1:465\n";
'

echo
echo "==> [11/12] Optional authenticated send test"
if [[ -n "${RC_USER:-}" && -n "${RC_PASS:-}" ]]; then
  export RC_USER RC_PASS
  export RC_TO="${RC_TO:-${RC_USER}}"
  php -r '
$user = getenv("RC_USER");
$pass = getenv("RC_PASS");
$to = getenv("RC_TO") ?: $user;
$ctx = stream_context_create(["ssl"=>[
  "verify_peer"=>false,"verify_peer_name"=>false,
  "peer_name"=>"mail.globalorbitmail.cloud","allow_self_signed"=>true
]]);
$fp = stream_socket_client("ssl://127.0.0.1:465", $e, $s, 20, STREAM_CLIENT_CONNECT, $ctx);
if (!$fp) { fwrite(STDERR, "connect fail: $s\n"); exit(1); }
function expect($fp, $code) {
  $line = fgets($fp);
  echo $line;
  if (strpos($line, (string)$code) !== 0) { fwrite(STDERR, "expected $code got $line\n"); exit(1); }
  while (isset($line[3]) && $line[3] === "-") { $line = fgets($fp); echo $line; }
}
function cmd($fp, $c, $code) { fwrite($fp, $c."\r\n"); expect($fp, $code); }
expect($fp, 220);
cmd($fp, "EHLO orbit-auth-test.local", 250);
$plain = base64_encode("\0{$user}\0{$pass}");
cmd($fp, "AUTH PLAIN {$plain}", 235);
cmd($fp, "MAIL FROM:<{$user}>", 250);
cmd($fp, "RCPT TO:<{$to}>", 250);
cmd($fp, "DATA", 354);
$msg = "Subject: Orbit Roundcube SMTP fix ".date("c")."\r\nFrom: {$user}\r\nTo: {$to}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nDate: ".date("r")."\r\nMessage-ID: <orbit-fix-".time()."@local>\r\n\r\nOrbit SMTP path restored.\r\n.\r\n";
fwrite($fp, $msg);
expect($fp, 250);
cmd($fp, "QUIT", 221);
echo "PASS: authenticated SMTP send accepted by Postfix\n";
'
else
  echo "    Skipped (set RC_USER RC_PASS to run live AUTH+send)."
fi

echo
echo "==> [12/12] Final log snapshot"
tail -n 30 /var/log/mail.log 2>/dev/null || true

cat <<EOF

DONE.

Roundcube config:
  smtp_host = ssl://127.0.0.1:465
  smtp_user = %u
  smtp_pass = %p
  smtp-transport.inc.php included LAST in config.inc.php

Next (manual UI proof):
  1) Open https://webmail.globalorbitmail.cloud
  2) Compose → send to a Gmail address
  3) Confirm no "Failed to reach the server!"
  4) Check Gmail inbox + Show original

If still failing:
  tail -100 /var/log/mail.log
  tail -100 ${RC_ROOT}/logs/errors.log
  tail -100 ${RC_ROOT}/logs/smtp
EOF
