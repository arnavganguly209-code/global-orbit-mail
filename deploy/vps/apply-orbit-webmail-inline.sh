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
git pull --ff-only origin main

# Ensure .env has IMAP/SMTP localhost for VPS if missing
if [[ -f .env ]]; then
  grep -q '^WEBMAIL_IMAP_HOST=' .env || echo 'WEBMAIL_IMAP_HOST=127.0.0.1' >> .env
  grep -q '^WEBMAIL_IMAP_PORT=' .env || echo 'WEBMAIL_IMAP_PORT=143' >> .env
  grep -q '^WEBMAIL_SMTP_HOST=' .env || echo 'WEBMAIL_SMTP_HOST=127.0.0.1' >> .env
  grep -q '^WEBMAIL_SMTP_PORT=' .env || echo 'WEBMAIL_SMTP_PORT=465' >> .env
fi

bash deploy/vps/deploy-orbit-webmail.sh

echo
echo "Inline webmail deploy finished."
echo "Verify: https://webmail.globalorbitmail.cloud/webmail/login"
