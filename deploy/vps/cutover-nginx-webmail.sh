#!/usr/bin/env bash
# EMERGENCY: Nginx-only cutover — fully self-contained (no git clone required).
# Assumes Next.js already listens on 127.0.0.1:3100.
#
#   curl -fsSL https://raw.githubusercontent.com/arnavganguly209-code/global-orbit-mail/main/deploy/vps/cutover-nginx-webmail.sh | bash
#
set -euo pipefail

WEBMAIL_HOST="${WEBMAIL_HOSTNAME:-webmail.globalorbitmail.cloud}"
UPSTREAM="127.0.0.1:${ORBIT_WEBMAIL_PORT:-3100}"
TS="$(date +%Y%m%d%H%M%S)"
SITE="/etc/nginx/sites-available/${WEBMAIL_HOST}"
LINK="/etc/nginx/sites-enabled/${WEBMAIL_HOST}"

echo "=== Orbit Nginx cutover ${WEBMAIL_HOST} → ${UPSTREAM} ==="

command -v nginx >/dev/null
command -v curl >/dev/null

NC="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${WEBMAIL_HOST}" "http://${UPSTREAM}/login" || true)"
if [[ ! "$NC" =~ ^(200|302|307|308)$ ]]; then
  echo "Next not ready yet (HTTP $NC) — waiting..."
  for i in $(seq 1 40); do
    NC="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${WEBMAIL_HOST}" "http://${UPSTREAM}/login" || true)"
    [[ "$NC" =~ ^(200|302|307|308)$ ]] && break
    sleep 1
  done
fi
[[ "$NC" =~ ^(200|302|307|308)$ ]] || { echo "FATAL: Next not on ${UPSTREAM} (HTTP $NC)"; exit 1; }
echo "Next OK ($NC)"

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled "/root/orbit-nginx-backups/$TS"
find /etc/nginx -type f \( -name '*.conf' -o -path '*/sites-enabled/*' -o -path '*/sites-available/*' \) 2>/dev/null \
  | while read -r f; do
      grep -Eiq "${WEBMAIL_HOST}|roundcube|/var/www/roundcube" "$f" 2>/dev/null || continue
      cp -a "$f" "/root/orbit-nginx-backups/$TS/" || true
      echo "backed up $f"
    done

# Detect cert from live nginx for this host, then LE dirs
detect_ssl() {
  local dump cert key conf d
  dump="$(nginx -T 2>/dev/null || true)"
  cert="$(printf '%s\n' "$dump" | awk -v h="$WEBMAIL_HOST" 'BEGIN{b=0} /server_name/&&index($0,h){b=1} b&&/ssl_certificate /&&$0!~/key/{gsub(/;/,"");print $2;exit} b&&/^[[:space:]]*}/{b=0}')"
  key="$(printf '%s\n' "$dump" | awk -v h="$WEBMAIL_HOST" 'BEGIN{b=0} /server_name/&&index($0,h){b=1} b&&/ssl_certificate_key /{gsub(/;/,"");print $2;exit} b&&/^[[:space:]]*}/{b=0}')"
  if [[ -f "${cert:-}" && -f "${key:-}" ]]; then echo "$cert|$key"; return; fi
  while read -r conf; do
    grep -q "server_name.*${WEBMAIL_HOST}" "$conf" 2>/dev/null || continue
    cert="$(awk '/ssl_certificate / && $0 !~ /key/ {gsub(/;/,""); print $2; exit}' "$conf")"
    key="$(awk '/ssl_certificate_key / {gsub(/;/,""); print $2; exit}' "$conf")"
    [[ -f "${cert:-}" && -f "${key:-}" ]] && { echo "$cert|$key"; return; }
  done < <(find /etc/nginx -type f 2>/dev/null)
  for d in "/etc/letsencrypt/live/${WEBMAIL_HOST}" /etc/letsencrypt/live/*webmail* /etc/letsencrypt/live/*globalorbit* /etc/letsencrypt/live/*; do
    [[ -f "$d/fullchain.pem" && -f "$d/privkey.pem" ]] && { echo "$d/fullchain.pem|$d/privkey.pem"; return; }
  done
  return 1
}

PAIR="$(detect_ssl || true)"
[[ -n "$PAIR" ]] || { echo "FATAL: no TLS cert found"; exit 1; }
CERT="${PAIR%%|*}"; KEY="${PAIR##*|}"
# Never keep a non-existent LE path (common mistake: webmail.* dir missing)
if [[ ! -f "$CERT" || ! -f "$KEY" ]]; then
  echo "FATAL: detected TLS paths do not exist on disk: $CERT / $KEY" >&2
  exit 1
fi
echo "TLS $CERT"

OPT=""; DH=""
[[ -f /etc/letsencrypt/options-ssl-nginx.conf ]] && OPT="include /etc/letsencrypt/options-ssl-nginx.conf;"
[[ -f /etc/letsencrypt/ssl-dhparams.pem ]] && DH="ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"

# Drop server{} blocks that claim WEBMAIL_HOST from OTHER site files (keeps apex sites intact)
python3 - "$WEBMAIL_HOST" <<'PY' || true
import sys
from pathlib import Path
host = sys.argv[1]
roots = [Path("/etc/nginx/sites-available"), Path("/etc/nginx/sites-enabled"), Path("/etc/nginx/conf.d")]
skip_names = {host, f"{host}.conf"}
for root in roots:
    if not root.exists():
        continue
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.name in skip_names:
            continue
        text = path.read_text(errors="ignore")
        if host not in text:
            continue
        parts, buf, depth, started = [], [], 0, False
        for line in text.splitlines(True):
            if (not started) and line.lstrip().startswith("server") and "{" in line:
                if buf:
                    parts.append("".join(buf)); buf = []
                started = True
            if started:
                buf.append(line)
                depth += line.count("{") - line.count("}")
                if depth <= 0:
                    parts.append("".join(buf)); buf = []; started = False; depth = 0
            else:
                parts.append(line)
        kept = []
        changed = False
        for p in parts:
            if f"server_name {host}" in p or f"server_name {host};" in p:
                # drop blocks whose only/primary claim is the webmail host
                if "www." + host.split(".", 1)[-1] not in p or host in p:
                    # If this block is dedicated to webmail host, drop it
                    if p.count("server_name") == 1 and host in p and f"server_name {host.replace('webmail.', '')}" not in p:
                        print(f"strip webmail block from {path}")
                        changed = True
                        continue
                    if f"server_name {host};" in p and "globalorbitmail.cloud www" not in p:
                        print(f"strip webmail-only block from {path}")
                        changed = True
                        continue
            kept.append(p)
        if changed:
            path.write_text("".join(kept))
PY

cat > "$SITE" <<EOF
upstream orbit_webmail_upstream { server ${UPSTREAM}; keepalive 32; }
map \$arg__task \$orbit_is_roundcube_task { default 0; "~.+" 1; }
server {
  listen 80; listen [::]:80; server_name ${WEBMAIL_HOST};
  return 301 https://\$host\$request_uri;
}
server {
  listen 443 ssl http2; listen [::]:443 ssl http2; server_name ${WEBMAIL_HOST};
  ssl_certificate ${CERT};
  ssl_certificate_key ${KEY};
  ${OPT}
  ${DH}
  client_max_body_size 50m;
  location ~* \\.php(/|\$) { return 301 /; }
  location ~* ^/(skins|plugins|program|installer|bin|SQL|vendor|temp|logs)(/|\$) { return 301 /; }
  location = /index.php { return 301 /; }
  if (\$orbit_is_roundcube_task = 1) { return 301 /; }
  location / {
    proxy_pass http://orbit_webmail_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
  }
}
EOF
ln -sfn "$SITE" "$LINK"

# Remove enabled units that still exclusively serve Roundcube for this host
shopt -s nullglob
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*; do
  [[ -e "$f" ]] || continue
  real="$(readlink -f "$f" 2>/dev/null || echo "$f")"
  [[ "$real" == "$(readlink -f "$SITE")" ]] && continue
  if grep -Eq "server_name[[:space:]]+${WEBMAIL_HOST};" "$f" 2>/dev/null; then
    if grep -Eiq "roundcube|/var/www/roundcube" "$f" 2>/dev/null; then
      echo "disable competing Roundcube claim: $f"
      rm -f "$f"
    fi
  fi
done
shopt -u nullglob

for i in 1 2 3 4 5 6; do
  if nginx -t 2>/tmp/ngx.err; then echo "nginx -t OK"; break; fi
  cat /tmp/ngx.err >&2
  # drop duplicate upstream/map files
  grep -Rl "orbit_webmail_upstream\|orbit_is_roundcube_task" /etc/nginx 2>/dev/null | while read -r h; do
    [[ "$(readlink -f "$h")" == "$(readlink -f "$SITE")" ]] && continue
    echo "rm dup $h"; rm -f "$h"
  done
  # strip missing paths from our site
  grep -Eo '/[A-Za-z0-9._/-]+\.(conf|pem)' /tmp/ngx.err 2>/dev/null | while read -r p; do
    [[ -e "$p" ]] && continue
    grep -Fq "$p" "$SITE" && sed -i "\|$p|d" "$SITE"
  done
  [[ $i -eq 6 ]] && exit 1
done

systemctl reload nginx
sleep 1

BODY="$(curl -fsSL "https://${WEBMAIL_HOST}/" || true)"
if printf '%s' "$BODY" | grep -Eiq 'skins/elastic|rcmlogin|roundcube'; then
  echo "FAIL still Roundcube"; ls -la /etc/nginx/sites-enabled/; nginx -T 2>/dev/null | grep -nE "server_name|root |proxy_pass|roundcube" | head -80; exit 1
fi
if printf '%s' "$BODY" | grep -Eiq '_next/static|Sign In|Global Orbit'; then
  echo "PASS Next.js is live at /"
else
  echo "WARN markers unclear"; curl -sI "https://${WEBMAIL_HOST}/" | head -20
fi
# Legacy path must redirect away from /webmail
LOC="$(curl -sI "https://${WEBMAIL_HOST}/webmail/login" | tr -d '\r' | awk 'tolower($1)==\"location:\"{print $2; exit}')"
echo "legacy /webmail/login Location: ${LOC:-none}"
echo "DONE"
