#!/usr/bin/env bash
# One-shot Global Orbit Mail Next.js webmail cutover (VPS console).
# Paste as root:
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

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js missing — installing Node 20 via NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

need_cmd node
need_cmd npm

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

# Ensure runtime env for IMAP/SMTP + session crypto
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

if ! grep -q '^AUTH_SECRET=' .env || grep -q '^AUTH_SECRET=""$' .env || grep -q '^AUTH_SECRET=$' .env; then
  GEN="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)"
  if grep -q '^AUTH_SECRET=' .env; then
    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"${GEN}\"|" .env
  else
    echo "AUTH_SECRET=\"${GEN}\"" >> .env
  fi
  echo "Generated AUTH_SECRET for webmail sessions."
fi

# Prisma generate needs a URL even if webmail itself uses IMAP
if ! grep -q '^DATABASE_URL=' .env || grep -q '^DATABASE_URL=""$' .env; then
  ensure_env DATABASE_URL "postgresql://orbit:orbit@127.0.0.1:5432/orbit?schema=public"
  echo "WARNING: DATABASE_URL was missing — placeholder set. Admin/customer DB features may need a real URL."
fi

bash deploy/vps/deploy-orbit-webmail.sh

echo
echo "Local smoke…"
sleep 2
if curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:3100/webmail/login" | grep -qE '200|302|307'; then
  echo "PM2 Next.js responds on :3100/webmail/login"
else
  echo "WARNING: localhost:3100/webmail/login did not return OK — check: pm2 logs orbit-webmail"
  pm2 describe orbit-webmail || true
fi

echo
echo "Inline webmail deploy finished."
echo "Verify: https://webmail.globalorbitmail.cloud/webmail/login"
echo "Roundcube must NOT appear. Old ?_task= URLs must redirect to login."
