# GLOBAL ORBIT MAIL — Windows → VPS production deploy
# Uses the Orbit webmail SSH key permanently.
#
#   powershell -ExecutionPolicy Bypass -File deploy/vps/deploy-from-windows.ps1
#   powershell -ExecutionPolicy Bypass -File deploy/vps/deploy-from-windows.ps1 -NginxOnly
#
param(
  [switch]$NginxOnly,
  [string]$HostAddress = "200.97.170.235",
  [string]$User = "root",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\orbit_webmail_ed25519"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $KeyPath)) {
  Write-Error "SSH key not found: $KeyPath"
}

$ssh = @("-i", $KeyPath, "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "${User}@${HostAddress}")

Write-Host "Deploying to ${User}@${HostAddress} ..."

if ($NginxOnly) {
  $remote = @'
set -euo pipefail
cd /var/www/global-orbit-mail || cd /root/global-orbit-mail
git fetch origin
git reset --hard origin/main
bash deploy/vps/cutover-nginx-webmail.sh
'@
} else {
  $remote = @'
set -euo pipefail
REPO=""
for cand in /var/www/global-orbit-mail /root/global-orbit-mail /opt/global-orbit-mail; do
  if [[ -d "$cand/.git" ]]; then REPO="$cand"; break; fi
done
if [[ -z "$REPO" ]]; then
  REPO=/var/www/global-orbit-mail
  git clone https://github.com/arnavganguly209-code/global-orbit-mail.git "$REPO"
fi
cd "$REPO"
git fetch origin
git reset --hard origin/main
# Ensure webmail env
if [[ -f .env ]]; then
  grep -q '^WEBMAIL_IMAP_HOST=' .env || echo 'WEBMAIL_IMAP_HOST=127.0.0.1' >> .env
  grep -q '^WEBMAIL_SMTP_HOST=' .env || echo 'WEBMAIL_SMTP_HOST=127.0.0.1' >> .env
fi
bash deploy/vps/deploy-orbit-webmail.sh
# Wait until Next answers before nginx cutover
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: webmail.globalorbitmail.cloud" http://127.0.0.1:3100/login || true)
  if [[ "$code" == "200" || "$code" == "302" || "$code" == "307" || "$code" == "308" ]]; then
    break
  fi
  sleep 1
done
# Always re-assert nginx cutover after deploy
bash deploy/vps/cutover-nginx-webmail.sh
'@
}

$remote | & ssh @ssh "bash -s"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Verifying public site..."
$home = Invoke-WebRequest "https://webmail.globalorbitmail.cloud/" -UseBasicParsing
if ($home.Content -match 'skins/elastic|rcmlogin|roundcube') {
  Write-Error "Public site still looks like Roundcube"
}
if ($home.Content -notmatch '_next/static') {
  Write-Error "Public site missing Next.js markers"
}
$legacy = Invoke-WebRequest "https://webmail.globalorbitmail.cloud/webmail/login" -MaximumRedirection 0 -ErrorAction SilentlyContinue
Write-Host "OK - https://webmail.globalorbitmail.cloud/ is Next.js Orbit webmail"
