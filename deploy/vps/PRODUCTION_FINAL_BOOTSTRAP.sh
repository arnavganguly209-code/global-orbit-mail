#!/usr/bin/env bash
# GLOBAL ORBIT MAIL — one-shot production final bootstrap (run ON the mail VPS as root)
# After this + app rebuild, Orbit self-heals forever via health / platform-ensure.
#
# Usage:
#   cd /path/to/global-orbit-mail
#   bash deploy/vps/PRODUCTION_FINAL_BOOTSTRAP.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> [1/6] Install mail-agent + apply scripts"
mkdir -p /opt/global-orbit/bin
install -m 755 deploy/vps/mail-agent.sh /opt/global-orbit/bin/mail-agent.sh
install -m 755 deploy/vps/apply-attachment-limits-inline.sh /opt/global-orbit/bin/apply-attachment-limits-inline.sh

echo "==> [2/6] Apply attachment / size / IPv4 limits"
bash /opt/global-orbit/bin/apply-attachment-limits-inline.sh

echo "==> [3/6] Maildir + Roundcube permissions"
if id -u vmail >/dev/null 2>&1; then
  chown -R vmail:vmail /var/mail/vhosts 2>/dev/null || true
fi
if [[ -d /var/www/roundcube ]]; then
  chown -R www-data:www-data /var/www/roundcube/temp /var/www/roundcube/logs 2>/dev/null || true
  chmod 775 /var/www/roundcube/temp /var/www/roundcube/logs 2>/dev/null || true
fi

echo "==> [4/6] Build Orbit Admin (if package.json present)"
if [[ -f package.json ]]; then
  npm ci --omit=dev 2>/dev/null || npm install --omit=dev
  npx prisma generate
  npm run build
fi

echo "==> [5/6] Restart app + PHP-FPM + Nginx"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart all || true
fi
systemctl reload php8.3-fpm 2>/dev/null || systemctl reload php8.2-fpm 2>/dev/null || systemctl reload php8.1-fpm 2>/dev/null || true
systemctl reload nginx 2>/dev/null || true
systemctl reload postfix 2>/dev/null || true

echo "==> [6/6] Verify PHP CLI limits"
php -r 'echo "upload_max_filesize=".ini_get("upload_max_filesize")." post_max_size=".ini_get("post_max_size")."\n";' || true
postconf message_size_limit inet_protocols 2>/dev/null || true

echo
echo "BOOTSTRAP COMPLETE."
echo "Trigger: curl -X POST https://admin.theglobalorbit.com/api/admin/system/platform-ensure (with session)"
echo "Or open Orbit Admin → System health (auto ensurePlatform)."
