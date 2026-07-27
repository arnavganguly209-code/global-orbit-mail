#!/usr/bin/env bash
# One-shot Global Orbit Mail Next.js webmail cutover (VPS console / root).
#   curl -fsSL https://raw.githubusercontent.com/arnavganguly209-code/global-orbit-mail/main/deploy/vps/apply-orbit-webmail-inline.sh | bash
#
set -euo pipefail

REPO_URL="${ORBIT_REPO_URL:-https://github.com/arnavganguly209-code/global-orbit-mail.git}"
REPO_DIR="${ORBIT_REPO_DIR:-}"

echo "=============================================="
echo " GLOBAL ORBIT — inline Next.js webmail deploy"
echo "=============================================="

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: missing required command: $1" >&2
    exit 1
  }
}

need_cmd git
need_cmd curl
need_cmd nginx

export DEBIAN_FRONTEND=noninteractive

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

need_cmd node
need_cmd npm

# Optional: ensure build tools for native modules
apt-get install -y build-essential python3 >/dev/null 2>&1 || true

if [[ -z "$REPO_DIR" ]]; then
  for cand in /root/global-orbit-mail /var/www/global-orbit-mail /opt/global-orbit-mail /home/*/global-orbit-mail; do
    if [[ -d "$cand/.git" ]]; then REPO_DIR="$cand"; break; fi
  done
fi

if [[ -z "${REPO_DIR:-}" || ! -d "${REPO_DIR}/.git" ]]; then
  REPO_DIR="/root/global-orbit-mail"
  if [[ ! -d "$REPO_DIR/.git" ]]; then
    git clone "$REPO_URL" "$REPO_DIR"
  fi
fi

cd "$REPO_DIR"
git fetch origin
git checkout main
git reset --hard origin/main

if [[ ! -f .env ]]; then
  echo "Creating .env from .env.example…"
  cp .env.example .env
fi

ensure_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    return 0
  fi
  echo "${key}=${val}" >> .env
}

ensure_env WEBMAIL_IMAP_HOST "127.0.0.1"
ensure_env WEBMAIL_IMAP_PORT "143"
ensure_env WEBMAIL_IMAP_SECURE "false"
ensure_env WEBMAIL_SMTP_HOST "127.0.0.1"
ensure_env WEBMAIL_SMTP_PORT "465"
ensure_env WEBMAIL_SMTP_SECURE "true"
ensure_env WEBMAIL_HOSTNAME "webmail.globalorbitmail.cloud"
ensure_env ADMIN_AUTH_ENFORCE "true"

if ! grep -q '^AUTH_SECRET=' .env || grep -qE '^AUTH_SECRET=(""|)$' .env; then
  GEN="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)"
  if grep -q '^AUTH_SECRET=' .env; then
    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"${GEN}\"|" .env
  else
    echo "AUTH_SECRET=\"${GEN}\"" >> .env
  fi
  echo "Generated AUTH_SECRET for webmail sessions."
fi

if ! grep -q '^DATABASE_URL=' .env || grep -qE '^DATABASE_URL=(""|)$' .env; then
  ensure_env DATABASE_URL "postgresql://orbit:orbit@127.0.0.1:5432/orbit?schema=public"
  echo "WARNING: DATABASE_URL placeholder set (admin DB features may need a real URL)."
fi

# Dump current nginx webmail-related config for logs
echo "—— Pre-cutover nginx webmail references ——"
nginx -T 2>/dev/null | grep -nE "webmail|roundcube|/var/www/roundcube|ssl_certificate" | head -80 || true
echo "—— End pre-cutover dump ——"

bash deploy/vps/deploy-orbit-webmail.sh

echo
echo "Post-cutover public checks…"
curl -sI "https://webmail.globalorbitmail.cloud/" | head -20 || true
curl -sI "https://webmail.globalorbitmail.cloud/webmail/login" | head -20 || true
BODY="$(curl -fsSL "https://webmail.globalorbitmail.cloud/webmail/login" || true)"
if printf '%s' "$BODY" | grep -Eiq 'skins/elastic|rcmlogin|roundcube'; then
  echo "FAIL: Roundcube still visible on /webmail/login" >&2
  exit 1
fi
if printf '%s' "$BODY" | grep -Eiq '_next/static|Sign In|Global Orbit Mail'; then
  echo "PASS: Next.js Orbit login is live."
else
  echo "WARN: Could not confirm Next markers; inspect https://webmail.globalorbitmail.cloud/webmail/login"
fi

echo
echo "Inline webmail deploy finished."
