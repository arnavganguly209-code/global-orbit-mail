#!/usr/bin/env bash
# One-shot Orbit skin apply for VPS console (no SSH key required from workstation).
# Paste on the mail VPS as root:
#   curl -fsSL https://raw.githubusercontent.com/arnavganguly209-code/global-orbit-mail/main/deploy/vps/apply-orbit-skin-inline.sh | bash
#
set -euo pipefail

REPO_URL="${ORBIT_REPO_URL:-https://github.com/arnavganguly209-code/global-orbit-mail.git}"
REPO_DIR="${ORBIT_REPO_DIR:-}"
RC_ROOT="${ORBIT_ROUNDCUBE_ROOT:-/var/www/roundcube}"

echo "=============================================="
echo " GLOBAL ORBIT — inline Orbit skin deploy"
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

export ORBIT_ROUNDCUBE_ROOT="$RC_ROOT"
bash deploy/vps/deploy-orbit-skin.sh

echo
echo "Inline deploy finished."
