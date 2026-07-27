#!/usr/bin/env bash
# Deploy GLOBAL ORBIT MAIL premium Orbit skin to live Roundcube.
# Does NOT modify IMAP/SMTP/Postfix/Dovecot auth.
#
# Usage (on VPS as root):
#   cd /path/to/global-orbit-mail && git pull
#   bash deploy/vps/deploy-orbit-skin.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RC_ROOT="${ORBIT_ROUNDCUBE_ROOT:-/var/www/roundcube}"
SRC="${REPO_ROOT}/roundcube/skins/orbit"
DST="${RC_ROOT}/skins/orbit"
CFG="${RC_ROOT}/config/config.inc.php"
BRAND_SRC="${REPO_ROOT}/roundcube/config/orbit-branding.inc.php"
BRAND_DST="${RC_ROOT}/config/orbit-branding.inc.php"

echo "=============================================="
echo " Deploy Orbit premium skin → ${DST}"
echo "=============================================="

if [[ ! -d "$SRC" ]]; then
  echo "ERROR: missing $SRC" >&2
  exit 1
fi
if [[ ! -d "$RC_ROOT" ]]; then
  echo "ERROR: Roundcube root not found: $RC_ROOT" >&2
  exit 1
fi

# Elastic must remain installed (Orbit extends it)
if [[ ! -d "${RC_ROOT}/skins/elastic" ]]; then
  echo "ERROR: skins/elastic missing — Orbit extends Elastic" >&2
  exit 1
fi

TS="$(date +%Y%m%d%H%M%S)"
if [[ -d "$DST" ]]; then
  cp -a "$DST" "${DST}.bak.${TS}"
  echo "Backup: ${DST}.bak.${TS}"
fi

mkdir -p "$DST"
rsync -a --delete \
  --exclude 'references' \
  "$SRC/" "$DST/"

# Permissions
chown -R www-data:www-data "$DST" 2>/dev/null || chown -R apache:apache "$DST" 2>/dev/null || true
find "$DST" -type d -exec chmod 755 {} \;
find "$DST" -type f -exec chmod 644 {} \;

# Branding include
if [[ -f "$BRAND_SRC" ]]; then
  cp -a "$BRAND_SRC" "$BRAND_DST"
  chown www-data:www-data "$BRAND_DST" 2>/dev/null || true
fi

if [[ -f "$CFG" ]]; then
  cp -a "$CFG" "${CFG}.bak.skin.${TS}"
  python3 - <<'PY' "$CFG"
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()
# Force skin + product name
def upsert(key, value):
    global text
    pat = rf"(?m)^(\s*)\$config\[['\"]{key}['\"]\]\s*=\s*.*;\s*$"
    line = f"$config['{key}'] = {value};"
    if re.search(pat, text):
        text = re.sub(pat, line, text)
    else:
        text = text.rstrip() + f"\n{line}\n"

upsert("skin", "'orbit'")
upsert("product_name", "'Global Orbit Mail'")
upsert("display_product_info", "0")
needle = "include __DIR__ . '/orbit-branding.inc.php';"
if needle not in text:
    text = text.rstrip() + f"\n\n// GLOBAL ORBIT — premium skin branding\n{needle}\n"
open(path, "w", encoding="utf-8").write(text)
print("patched", path)
PY
  php -l "$CFG" || true
fi

# Clear Roundcube caches
rm -rf "${RC_ROOT}/temp/cache" "${RC_ROOT}/temp/cache_"* 2>/dev/null || true
systemctl reload php8.3-fpm 2>/dev/null || systemctl reload php8.2-fpm 2>/dev/null || systemctl reload php8.1-fpm 2>/dev/null || true
systemctl reload nginx 2>/dev/null || true

echo
echo "DONE. Open https://webmail.globalorbitmail.cloud/ (hard refresh Ctrl+Shift+R)"
echo "Login page should show split Earth hero + glass card + official logo (transparent)."
echo "IMAP/SMTP untouched."
