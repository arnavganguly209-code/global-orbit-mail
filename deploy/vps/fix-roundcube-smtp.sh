#!/usr/bin/env bash
# Fix Roundcube 1.6 SMTP AUTH: require tls:// on smtp_host so STARTTLS runs.
# Does NOT modify Postfix or Dovecot.
#
# Usage (on mail/webmail VPS as root):
#   bash deploy/vps/fix-roundcube-smtp.sh
#   bash deploy/vps/fix-roundcube-smtp.sh /var/www/roundcube
#
set -euo pipefail

RC_ROOT="${1:-/var/www/roundcube}"
CFG="${RC_ROOT}/config/config.inc.php"
SNIPPET_SRC="$(cd "$(dirname "$0")/../.." && pwd)/roundcube/config/smtp-transport.inc.php"
SNIPPET_DST="${RC_ROOT}/config/smtp-transport.inc.php"

if [[ ! -f "$CFG" ]]; then
  echo "ERROR: Roundcube config not found: $CFG" >&2
  exit 1
fi

if [[ ! -f "$SNIPPET_SRC" ]]; then
  # Allow running from a copied script next to the snippet
  ALT="$(cd "$(dirname "$0")" && pwd)/smtp-transport.inc.php"
  if [[ -f "$ALT" ]]; then
    SNIPPET_SRC="$ALT"
  else
    echo "ERROR: smtp-transport.inc.php not found at $SNIPPET_SRC" >&2
    exit 1
  fi
fi

TS="$(date +%Y%m%d%H%M%S)"
cp -a "$CFG" "${CFG}.bak.smtp.${TS}"
echo "==> Backed up config → ${CFG}.bak.smtp.${TS}"

echo "==> Installing SMTP transport snippet"
cp -a "$SNIPPET_SRC" "$SNIPPET_DST"
chown www-data:www-data "$SNIPPET_DST" 2>/dev/null || chown apache:apache "$SNIPPET_DST" 2>/dev/null || true
chmod 640 "$SNIPPET_DST"

echo "==> Current smtp_* keys (before):"
grep -nE "smtp_(host|server|port|user|pass|auth|conn)" "$CFG" || echo "(none)"

# Comment obsolete 1.6-removed options so they cannot override behavior
python3 - <<'PY' "$CFG"
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()
# Comment active smtp_server / smtp_port assignments
def comment_key(src, key):
    return re.sub(
        rf'(?m)^(\s*)(\$config\[[\'\"]{key}[\'\"]\]\s*=)',
        rf'\1// FIXED-SMTP: obsolete in RC 1.6 — \2',
        src,
    )
text2 = comment_key(text, "smtp_server")
text2 = comment_key(text2, "smtp_port")
# Ensure include once
needle = "smtp-transport.inc.php"
if needle not in text2:
    text2 = text2.rstrip() + "\n\n// GLOBAL ORBIT — SMTP STARTTLS transport (Roundcube 1.6)\n"
    text2 += "include __DIR__ . '/smtp-transport.inc.php';\n"
open(path, "w", encoding="utf-8").write(text2)
print("patched", path)
PY

echo "==> smtp_* keys (after):"
grep -nE "smtp_(host|server|port|user|pass|auth|conn)|smtp-transport" "$CFG" || true

echo "==> PHP lint"
php -l "$CFG"
php -l "$SNIPPET_DST"

echo "==> Clear Roundcube caches"
rm -rf "${RC_ROOT}/temp/cache" "${RC_ROOT}/temp/cache_"* 2>/dev/null || true

echo "==> Reload PHP-FPM (best effort)"
systemctl reload php8.3-fpm 2>/dev/null \
  || systemctl reload php8.2-fpm 2>/dev/null \
  || systemctl reload php8.1-fpm 2>/dev/null \
  || systemctl reload php-fpm 2>/dev/null \
  || true

cat <<'EOF'

DONE. Verify:

  1) In config: $config['smtp_host'] = 'tls://127.0.0.1:587';
  2) Enable temporarily: $config['smtp_debug'] = true;
  3) Send a message from Roundcube
  4) logs/smtp → must show STARTTLS, then EHLO with AUTH PLAIN, then AUTH

If STARTTLS fails on cert verify, set verify_peer/verify_peer_name false
in config/smtp-transport.inc.php (peer_name still = mail.globalorbitmail.cloud).

Do NOT change Postfix/Dovecot for this issue.
EOF
