#!/usr/bin/env bash
# Fix Roundcube SMTP: use ssl://127.0.0.1:465 (implicit TLS), not PHP tls:// on 587.
# Does NOT modify Postfix or Dovecot.
#
# Usage (on mail/webmail VPS as root):
#   bash deploy/vps/fix-roundcube-smtp.sh
#   bash deploy/vps/fix-roundcube-smtp.sh /var/www/roundcube
#
set -euo pipefail

RC_ROOT="${1:-/var/www/roundcube}"
CFG="${RC_ROOT}/config/config.inc.php"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SNIPPET_SRC="${REPO_ROOT}/roundcube/config/smtp-transport.inc.php"
SNIPPET_DST="${RC_ROOT}/config/smtp-transport.inc.php"
TEST_SRC="${REPO_ROOT}/scripts/test-roundcube-smtp-php.php"

if [[ ! -f "$CFG" ]]; then
  echo "ERROR: Roundcube config not found: $CFG" >&2
  exit 1
fi

if [[ ! -f "$SNIPPET_SRC" ]]; then
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

echo "==> Installing SMTP transport snippet (ssl://127.0.0.1:465)"
cp -a "$SNIPPET_SRC" "$SNIPPET_DST"
chown www-data:www-data "$SNIPPET_DST" 2>/dev/null || chown apache:apache "$SNIPPET_DST" 2>/dev/null || true
chmod 640 "$SNIPPET_DST"

echo "==> Current smtp_* keys (before):"
grep -nE "smtp_(host|server|port|user|pass|auth|conn)" "$CFG" || echo "(none)"

python3 - <<'PY' "$CFG"
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()

def comment_key(src, key):
    return re.sub(
        rf'(?m)^(\s*)(\$config\[[\'\"]{key}[\'\"]\]\s*=)',
        rf'\1// FIXED-SMTP: obsolete/overridden — \2',
        src,
    )

text2 = comment_key(text, "smtp_server")
text2 = comment_key(text2, "smtp_port")
# Comment any previous smtp_host so the include wins cleanly
text2 = comment_key(text2, "smtp_host")

needle = "smtp-transport.inc.php"
if needle not in text2:
    text2 = text2.rstrip() + "\n\n// GLOBAL ORBIT — SMTP SMTPS transport (ssl://:465)\n"
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

echo "==> Connectivity / AUTH probe (PHP)"
if [[ -f "$TEST_SRC" ]]; then
  php "$TEST_SRC" || true
else
  echo "(test script not found at $TEST_SRC — skip)"
fi

cat <<'EOF'

DONE. Roundcube smtp_host is now ssl://127.0.0.1:465 (implicit TLS).

Verify in UI: compose + send from Roundcube.
Optional debug: set $config['smtp_debug']=true in smtp-transport.inc.php

Do NOT use stream_socket_client('tls://127.0.0.1:587') — that is implicit TLS on a STARTTLS port.
Do NOT change Postfix/Dovecot for this issue.
EOF
