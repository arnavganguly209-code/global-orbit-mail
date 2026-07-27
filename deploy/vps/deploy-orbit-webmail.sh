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
elif [[ -f roundcube/skins/orbit/references/orbit-login-earth.png ]]; then
  cp -f roundcube/skins/orbit/references/orbit-login-earth.png public/brand/login-earth.png
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

export PORT="$APP_PORT"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start npm --name "$APP_NAME" --cwd "$REPO_ROOT" -- start -- -p "$APP_PORT"
pm2 save || true

# Nginx vhost — proxy to Next only; preserve live TLS paths; kill Roundcube
CONF_SRC="${REPO_ROOT}/deploy/vps/nginx-webmail-next.conf"
if [[ -f "$CONF_SRC" ]]; then
  TS="$(date +%Y%m%d%H%M%S)"
  BAK=""
  if [[ -f "$NGINX_SITE" ]]; then
    BAK="${NGINX_SITE}.bak.${TS}"
    cp -a "$NGINX_SITE" "$BAK"
  fi

  sed "s/__ORBIT_WEBMAIL_PORT__/${APP_PORT}/g; s/__WEBMAIL_HOST__/${WEBMAIL_HOST}/g" "$CONF_SRC" > /tmp/orbit-webmail-nginx.conf

  # Preserve existing ssl_certificate / ssl_certificate_key from previous vhost
  if [[ -n "$BAK" ]]; then
    OLD_CERT="$(grep -E '^\s*ssl_certificate\s+' "$BAK" | head -1 | awk '{print $2}' | tr -d ';')" || true
    OLD_KEY="$(grep -E '^\s*ssl_certificate_key\s+' "$BAK" | head -1 | awk '{print $2}' | tr -d ';')" || true
    if [[ -n "${OLD_CERT:-}" && -f "$OLD_CERT" ]]; then
      sed -i "s|ssl_certificate     .*|ssl_certificate     ${OLD_CERT};|" /tmp/orbit-webmail-nginx.conf
    fi
    if [[ -n "${OLD_KEY:-}" && -f "$OLD_KEY" ]]; then
      sed -i "s|ssl_certificate_key .*|ssl_certificate_key ${OLD_KEY};|" /tmp/orbit-webmail-nginx.conf
    fi
  fi

  if [[ -d /etc/nginx/sites-available ]]; then
    cp /tmp/orbit-webmail-nginx.conf "$NGINX_SITE"
    ln -sfn "$NGINX_SITE" /etc/nginx/sites-enabled/webmail.globalorbitmail.cloud 2>/dev/null || true
  else
    cp /tmp/orbit-webmail-nginx.conf /etc/nginx/conf.d/orbit-webmail-next.conf
  fi

  # Disable any Roundcube / PHP webmail vhosts so they cannot steal the host
  for f in /etc/nginx/sites-enabled/roundcube \
           /etc/nginx/sites-enabled/roundcube.conf \
           /etc/nginx/sites-enabled/webmail \
           /etc/nginx/sites-enabled/00-roundcube \
           /etc/nginx/conf.d/roundcube.conf; do
    if [[ -e "$f" ]]; then
      echo "Disabling Roundcube nginx unit: $f"
      rm -f "$f"
    fi
  done

  # Ensure document-root PHP under /var/www/roundcube is not reachable via leftover aliases
  if [[ -d /etc/nginx/sites-enabled ]]; then
    if grep -RIl "roundcube\|/var/www/roundcube" /etc/nginx/sites-enabled 2>/dev/null | grep -v "webmail.globalorbitmail.cloud" >/tmp/orbit-rc-hits.txt; then
      while read -r hit; do
        [[ -z "$hit" ]] && continue
        echo "WARNING: Roundcube still referenced in $hit — review manually"
      done < /tmp/orbit-rc-hits.txt || true
    fi
  fi

  nginx -t
  systemctl reload nginx
fi

echo
echo "DONE. Open https://${WEBMAIL_HOST}/ → /webmail/login"
echo "Roundcube routes/assets blocked; PHP not served on this host."
echo "IMAP/SMTP/Postfix/Dovecot unchanged."
