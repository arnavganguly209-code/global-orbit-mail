#!/usr/bin/env bash
# Deploy GLOBAL ORBIT MAIL Next.js webmail on the mail VPS (PM2 + Nginx).
# Replaces Roundcube UI for webmail.globalorbitmail.cloud — mail stack unchanged.
#
# Usage (on VPS as root):
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

# Load .env into this shell for build/runtime hints (without clobbering exports above)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env || true
  set +a
  export WEBMAIL_IMAP_HOST="${WEBMAIL_IMAP_HOST:-127.0.0.1}"
  export WEBMAIL_IMAP_PORT="${WEBMAIL_IMAP_PORT:-143}"
  export WEBMAIL_SMTP_HOST="${WEBMAIL_SMTP_HOST:-127.0.0.1}"
  export WEBMAIL_SMTP_PORT="${WEBMAIL_SMTP_PORT:-465}"
fi

npm ci --legacy-peer-deps
npm run build

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

# ── Discover existing valid TLS cert/key (never invent a missing path) ──
detect_ssl_pair() {
  local host="$1"
  local cert="" key=""

  # 1) Dump full nginx config and find the server_name block for this host
  if command -v nginx >/dev/null 2>&1; then
    local dump
    dump="$(nginx -T 2>/dev/null || true)"
    if [[ -n "$dump" ]]; then
      cert="$(printf '%s\n' "$dump" | awk -v h="$host" '
        BEGIN{inblk=0}
        /server_name/ && index($0,h){inblk=1}
        inblk && /ssl_certificate / && $0 !~ /ssl_certificate_key/ {
          gsub(/;/,""); print $2; exit
        }
        inblk && /^[[:space:]]*}/ {inblk=0}
      ')"
      key="$(printf '%s\n' "$dump" | awk -v h="$host" '
        BEGIN{inblk=0}
        /server_name/ && index($0,h){inblk=1}
        inblk && /ssl_certificate_key / {
          gsub(/;/,""); print $2; exit
        }
        inblk && /^[[:space:]]*}/ {inblk=0}
      ')"
      if [[ -n "$cert" && -f "$cert" && -n "$key" && -f "$key" ]]; then
        echo "$cert|$key"
        return 0
      fi
    fi
  fi

  # 2) Grep all nginx conf files for this host
  local conf
  while IFS= read -r conf; do
    [[ -z "$conf" ]] && continue
    if grep -q "server_name.*${host}" "$conf" 2>/dev/null; then
      cert="$(grep -E '^\s*ssl_certificate\s+' "$conf" | grep -v certificate_key | head -1 | awk '{print $2}' | tr -d ';')"
      key="$(grep -E '^\s*ssl_certificate_key\s+' "$conf" | head -1 | awk '{print $2}' | tr -d ';')"
      if [[ -n "$cert" && -f "$cert" && -n "$key" && -f "$key" ]]; then
        echo "$cert|$key"
        return 0
      fi
    fi
  done < <(find /etc/nginx -type f \( -name '*.conf' -o -path '*/sites-enabled/*' -o -path '*/sites-available/*' \) 2>/dev/null)

  # 3) Let's Encrypt live directory for exact host
  if [[ -f "/etc/letsencrypt/live/${host}/fullchain.pem" && -f "/etc/letsencrypt/live/${host}/privkey.pem" ]]; then
    echo "/etc/letsencrypt/live/${host}/fullchain.pem|/etc/letsencrypt/live/${host}/privkey.pem"
    return 0
  fi

  # 4) Any LE live dir whose name contains webmail / globalorbitmail
  local d
  for d in /etc/letsencrypt/live/*; do
    [[ -d "$d" ]] || continue
    local base
    base="$(basename "$d")"
    if [[ "$base" == *webmail* || "$base" == *globalorbitmail* || "$base" == "$host" ]]; then
      if [[ -f "$d/fullchain.pem" && -f "$d/privkey.pem" ]]; then
        echo "$d/fullchain.pem|$d/privkey.pem"
        return 0
      fi
    fi
  done

  # 5) First valid LE pair as last resort
  for d in /etc/letsencrypt/live/*; do
    [[ -d "$d" ]] || continue
    if [[ -f "$d/fullchain.pem" && -f "$d/privkey.pem" ]]; then
      echo "$d/fullchain.pem|$d/privkey.pem"
      return 0
    fi
  done

  return 1
}

CONF_SRC="${REPO_ROOT}/deploy/vps/nginx-webmail-next.conf"
if [[ -f "$CONF_SRC" ]]; then
  TS="$(date +%Y%m%d%H%M%S)"
  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null || true

  # Backup every active nginx unit that mentions Roundcube or this host
  while IFS= read -r conf; do
    [[ -z "$conf" ]] && continue
    if grep -Eiq "roundcube|/var/www/roundcube|${WEBMAIL_HOST}" "$conf" 2>/dev/null; then
      cp -a "$conf" "${conf}.bak.${TS}" 2>/dev/null || true
    fi
  done < <(find /etc/nginx -type f \( -name '*.conf' -o -path '*/sites-enabled/*' \) 2>/dev/null)

  SSL_PAIR="$(detect_ssl_pair "$WEBMAIL_HOST" || true)"
  if [[ -z "${SSL_PAIR:-}" ]]; then
    echo "ERROR: No valid SSL certificate/key found for ${WEBMAIL_HOST}." >&2
    echo "Searched: nginx -T, /etc/nginx, /etc/letsencrypt/live/*" >&2
    exit 1
  fi
  SSL_CERT="${SSL_PAIR%%|*}"
  SSL_KEY="${SSL_PAIR##*|}"
  echo "Using TLS cert: $SSL_CERT"
  echo "Using TLS key:  $SSL_KEY"

  SSL_OPTIONS_LINE=""
  SSL_DHPARAM_LINE=""
  if [[ -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
    SSL_OPTIONS_LINE="include /etc/letsencrypt/options-ssl-nginx.conf;"
  fi
  if [[ -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
    SSL_DHPARAM_LINE="ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
  fi

  # Escape for sed
  esc() { printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'; }

  sed \
    -e "s/__ORBIT_WEBMAIL_PORT__/$(esc "$APP_PORT")/g" \
    -e "s/__WEBMAIL_HOST__/$(esc "$WEBMAIL_HOST")/g" \
    -e "s/__SSL_CERTIFICATE__/$(esc "$SSL_CERT")/g" \
    -e "s/__SSL_CERTIFICATE_KEY__/$(esc "$SSL_KEY")/g" \
    -e "s|__SSL_OPTIONS_LINE__|${SSL_OPTIONS_LINE}|g" \
    -e "s|__SSL_DHPARAM_LINE__|${SSL_DHPARAM_LINE}|g" \
    "$CONF_SRC" > /tmp/orbit-webmail-nginx.conf

  # Install as the ONLY public webmail vhost
  cp /tmp/orbit-webmail-nginx.conf "$NGINX_SITE"
  ln -sfn "$NGINX_SITE" /etc/nginx/sites-enabled/webmail.globalorbitmail.cloud

  # Remove competing Roundcube / PHP webmail frontends from enabled sites
  # (keep backups already made above)
  shopt -s nullglob
  for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*; do
    [[ -e "$f" ]] || continue
    base="$(basename "$f")"
    # Never delete our new vhost
    if [[ "$base" == "webmail.globalorbitmail.cloud" || "$base" == "orbit-webmail-next.conf" ]]; then
      continue
    fi
    if grep -Eiq "roundcube|/var/www/roundcube|server_name[[:space:]].*${WEBMAIL_HOST}" "$f" 2>/dev/null; then
      echo "Disabling competing frontend: $f"
      rm -f "$f"
    fi
  done
  shopt -u nullglob

  # Also drop default site if it serves Roundcube for this host
  if [[ -L /etc/nginx/sites-enabled/default ]] || [[ -f /etc/nginx/sites-enabled/default ]]; then
    if grep -Eiq "roundcube|/var/www/roundcube|${WEBMAIL_HOST}" /etc/nginx/sites-enabled/default 2>/dev/null; then
      echo "Disabling default site (Roundcube/webmail conflict)"
      rm -f /etc/nginx/sites-enabled/default
    fi
  fi

  # nginx -t loop: fix common leftover issues automatically
  for attempt in 1 2 3 4 5; do
    if nginx -t 2>/tmp/orbit-nginx-t.err; then
      echo "nginx -t OK (attempt ${attempt})"
      break
    fi
    echo "nginx -t failed (attempt ${attempt}):"
    cat /tmp/orbit-nginx-t.err >&2 || true

    # Auto-fix: remove duplicate upstream / map from other files
    if grep -q "duplicate upstream" /tmp/orbit-nginx-t.err 2>/dev/null; then
      while IFS= read -r hit; do
        [[ "$hit" == "$NGINX_SITE" ]] && continue
        [[ "$hit" == *webmail.globalorbitmail.cloud* ]] && continue
        echo "Removing duplicate upstream file: $hit"
        rm -f "$hit"
      done < <(grep -Rl "orbit_webmail_upstream" /etc/nginx 2>/dev/null || true)
      continue
    fi

    # Auto-fix: missing include path mentioned in error → strip from our conf
    if grep -Eo '/etc/[^ ]+\.(conf|pem)' /tmp/orbit-nginx-t.err >/tmp/orbit-missing-paths.txt 2>/dev/null; then
      while read -r p; do
        [[ -z "$p" ]] && continue
        if [[ ! -e "$p" ]]; then
          echo "Stripping missing path from vhost: $p"
          sed -i "\|${p}|d" "$NGINX_SITE"
        fi
      done < /tmp/orbit-missing-paths.txt
      continue
    fi

    if [[ "$attempt" -eq 5 ]]; then
      echo "ERROR: nginx -t still failing after auto-fixes" >&2
      exit 1
    fi
  done

  systemctl reload nginx
  echo "Nginx reloaded."
fi

# Wait for Next
for i in 1 2 3 4 5 6 7 8 9 10; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/webmail/login" || true)"
  if [[ "$code" == "200" || "$code" == "302" || "$code" == "307" ]]; then
    echo "Next.js healthy on :${APP_PORT} (HTTP ${code})"
    break
  fi
  sleep 1
  if [[ "$i" -eq 10 ]]; then
    echo "WARNING: Next.js not responding on :${APP_PORT} — pm2 logs:"
    pm2 logs "$APP_NAME" --lines 40 --nostream || true
  fi
done

# Public verification
PUB="$(curl -sL "https://${WEBMAIL_HOST}/webmail/login" || true)"
ROOT="$(curl -sL "https://${WEBMAIL_HOST}/" || true)"
if printf '%s' "$PUB$ROOT" | grep -Eiq 'skins/elastic|rcmlogin|roundcube'; then
  echo "ERROR: Public site still looks like Roundcube after cutover" >&2
  exit 1
fi
if ! printf '%s' "$PUB" | grep -Eiq 'Sign In|Global Orbit Mail|/brand/logo|_next/static'; then
  echo "WARNING: Login HTML markers not fully detected — check manually."
else
  echo "Public login looks like Orbit Next.js (not Roundcube)."
fi

echo
echo "DONE. https://${WEBMAIL_HOST}/ → Next.js Orbit webmail"
echo "Roundcube PHP left on disk but not publicly served."
echo "IMAP/SMTP/Postfix/Dovecot unchanged."
