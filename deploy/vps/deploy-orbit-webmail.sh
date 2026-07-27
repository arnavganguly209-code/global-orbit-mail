#!/usr/bin/env bash
# Deploy GLOBAL ORBIT MAIL Next.js webmail on the mail VPS (PM2 + Nginx).
# Replaces Roundcube UI for webmail.globalorbitmail.cloud — mail stack unchanged.
#
# Usage (on VPS as root):
#   cd /path/to/global-orbit-mail && git pull
#   bash deploy/vps/deploy-orbit-webmail.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_PORT="${ORBIT_WEBMAIL_PORT:-3100}"
APP_NAME="${ORBIT_WEBMAIL_PM2_NAME:-orbit-webmail}"
NGINX_SITE="${ORBIT_WEBMAIL_NGINX_SITE:-/etc/nginx/sites-available/webmail.globalorbitmail.cloud}"
WEBMAIL_HOST="${WEBMAIL_HOSTNAME:-webmail.globalorbitmail.cloud}"

cd "$REPO_ROOT"

echo "=============================================="
echo " Deploy Orbit Next.js webmail → :${APP_PORT}"
echo "=============================================="

if [[ ! -f package.json ]]; then
  echo "ERROR: package.json missing in $REPO_ROOT" >&2
  exit 1
fi

export WEBMAIL_IMAP_HOST="${WEBMAIL_IMAP_HOST:-127.0.0.1}"
export WEBMAIL_IMAP_PORT="${WEBMAIL_IMAP_PORT:-143}"
export WEBMAIL_IMAP_SECURE="${WEBMAIL_IMAP_SECURE:-false}"
export WEBMAIL_SMTP_HOST="${WEBMAIL_SMTP_HOST:-127.0.0.1}"
export WEBMAIL_SMTP_PORT="${WEBMAIL_SMTP_PORT:-465}"
export WEBMAIL_SMTP_SECURE="${WEBMAIL_SMTP_SECURE:-true}"

npm ci --legacy-peer-deps
npm run build

# Ensure brand assets exist
mkdir -p public/brand
if [[ -f roundcube/skins/orbit/images/logo.png ]]; then
  cp -f roundcube/skins/orbit/images/logo.png public/brand/logo.png
fi
if [[ -f roundcube/skins/orbit/images/login-earth.png ]]; then
  cp -f roundcube/skins/orbit/images/login-earth.png public/brand/login-earth.png
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start npm --name "$APP_NAME" -- start -- -p "$APP_PORT"
fi
pm2 save || true

# Nginx vhost — proxy to Next, keep TLS if already configured
CONF_SRC="${REPO_ROOT}/deploy/vps/nginx-webmail-next.conf"
if [[ -f "$CONF_SRC" ]]; then
  TS="$(date +%Y%m%d%H%M%S)"
  if [[ -f "$NGINX_SITE" ]]; then
    cp -a "$NGINX_SITE" "${NGINX_SITE}.bak.${TS}"
  fi
  # Render port into temp conf
  sed "s/__ORBIT_WEBMAIL_PORT__/${APP_PORT}/g; s/__WEBMAIL_HOST__/${WEBMAIL_HOST}/g" "$CONF_SRC" > /tmp/orbit-webmail-nginx.conf

  # Prefer sites-enabled pattern; fall back to conf.d
  if [[ -d /etc/nginx/sites-available ]]; then
    cp /tmp/orbit-webmail-nginx.conf "$NGINX_SITE"
    ln -sfn "$NGINX_SITE" /etc/nginx/sites-enabled/webmail.globalorbitmail.cloud 2>/dev/null || true
  else
    cp /tmp/orbit-webmail-nginx.conf /etc/nginx/conf.d/orbit-webmail-next.conf
  fi

  # Disable Roundcube-only catchalls for this host if present as separate file
  if [[ -f /etc/nginx/sites-enabled/roundcube ]]; then
    rm -f /etc/nginx/sites-enabled/roundcube
  fi

  nginx -t
  systemctl reload nginx
fi

echo
echo "DONE. Open https://${WEBMAIL_HOST}/ → redirects to /webmail/login"
echo "Roundcube PHP left on disk but no longer the public UI."
echo "IMAP/SMTP/Postfix/Dovecot unchanged."
