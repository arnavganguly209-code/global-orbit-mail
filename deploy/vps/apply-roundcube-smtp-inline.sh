#!/usr/bin/env bash
# Apply Roundcube SMTP SMTPS config on the mail/webmail VPS.
# Does NOT modify Postfix, Dovecot, or IMAP.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/arnavganguly209-code/global-orbit-mail/main/deploy/vps/apply-roundcube-smtp-inline.sh | bash
#   # or from a git checkout:
#   bash deploy/vps/apply-roundcube-smtp-inline.sh
#
set -euo pipefail

RC_ROOT="${1:-/var/www/roundcube}"
CFG="${RC_ROOT}/config/config.inc.php"
DST="${RC_ROOT}/config/smtp-transport.inc.php"

if [[ ! -f "$CFG" ]]; then
  echo "ERROR: missing $CFG" >&2
  exit 1
fi

TS="$(date +%Y%m%d%H%M%S)"
cp -a "$CFG" "${CFG}.bak.smtp.${TS}"
echo "Backup: ${CFG}.bak.smtp.${TS}"

cat > "$DST" <<'PHP'
<?php
/**
 * GLOBAL ORBIT MAIL — Roundcube SMTP (ssl://127.0.0.1:465)
 * Applied by apply-roundcube-smtp-inline.sh — do not edit Postfix/Dovecot.
 */
$config['smtp_host'] = 'ssl://127.0.0.1:465';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['smtp_auth_type'] = null;
$config['smtp_timeout'] = 30;
$config['smtp_conn_options'] = [
  'ssl' => [
    'verify_peer' => false,
    'verify_peer_name' => false,
    'peer_name' => 'mail.globalorbitmail.cloud',
    'allow_self_signed' => true,
  ],
];
$config['smtp_debug'] = true;
$config['smtp_log'] = true;
PHP

chown www-data:www-data "$DST" 2>/dev/null || chown apache:apache "$DST" 2>/dev/null || true
chmod 640 "$DST"

python3 - <<'PY' "$CFG"
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()
for key in ("smtp_server", "smtp_port", "smtp_host"):
    text = re.sub(
        rf'(?m)^(\s*)(\$config\[[\'\"]{key}[\'\"]\]\s*=)',
        rf'\1// ORBIT-SMTP-OVERRIDE — \2',
        text,
    )
if "smtp-transport.inc.php" not in text:
    text = text.rstrip() + "\n\ninclude __DIR__ . '/smtp-transport.inc.php';\n"
open(path, "w", encoding="utf-8").write(text)
print("patched", path)
PY

php -l "$CFG"
php -l "$DST"

# Prove PHP can open SMTPS the same way Roundcube/Net_SMTP will
php -r '
$ctx = stream_context_create(["ssl"=>["verify_peer"=>false,"verify_peer_name"=>false,"peer_name"=>"mail.globalorbitmail.cloud"]]);
$fp = @stream_socket_client("ssl://127.0.0.1:465", $e, $s, 10, STREAM_CLIENT_CONNECT, $ctx);
if (!$fp) { fwrite(STDERR, "PHP ssl://127.0.0.1:465 FAIL: $s ($e)\n"); exit(1); }
$banner = fgets($fp);
echo "PHP SMTPS OK: $banner";
fwrite($fp, "EHLO orbit-apply.local\r\n");
$caps="";
while (!feof($fp)) { $line=fgets($fp); $caps.=$line; if (isset($line[3]) && $line[3]===" ") break; }
echo $caps;
if (stripos($caps, "AUTH") === false) { fwrite(STDERR, "AUTH missing on 465\n"); exit(1); }
fwrite($fp, "QUIT\r\n");
fclose($fp);
echo "AUTH present on ssl://127.0.0.1:465\n";
'

rm -rf "${RC_ROOT}/temp/cache" "${RC_ROOT}/temp/cache_"* 2>/dev/null || true
systemctl reload php8.3-fpm 2>/dev/null || systemctl reload php8.2-fpm 2>/dev/null || systemctl reload php8.1-fpm 2>/dev/null || true

echo
echo "Roundcube SMTP set to ssl://127.0.0.1:465"
echo "Send a message from Roundcube, then: tail -n 80 ${RC_ROOT}/logs/smtp"
echo "Disable smtp_debug in $DST after verification."
