#!/usr/bin/env bash
# Harden outbound delivery + attachment path (Workspace/Zoho-class).
# Safe to re-run. Does NOT wipe Postfix auth / Dovecot SQL / Roundcube IMAP.
#
# Fixes addressed:
#  - PHP upload_max_filesize / post_max_size
#  - Nginx client_max_body_size
#  - Postfix message_size_limit + myhostname alignment with PTR
#  - Roundcube temp + attachment includes
#  - OpenDKIM presence / signing check
#  - Mail queue visibility
#
# Usage (on mail VPS as root):
#   bash deploy/vps/harden-mail-delivery.sh
#
set -euo pipefail

RC_ROOT="${RC_ROOT:-/var/www/roundcube}"
MAIL_IP="${MAIL_IP:-200.97.170.235}"
# PTR for this IP is currently mail.theglobalorbit.com — EHLO MUST match PTR
PTR_HOSTNAME="${PTR_HOSTNAME:-mail.theglobalorbit.com}"
PUBLIC_MAIL_HOSTNAME="${PUBLIC_MAIL_HOSTNAME:-mail.globalorbitmail.cloud}"
MSG_BYTES="${MSG_BYTES:-26214400}"   # 25 MiB
PHP_UPLOAD="${PHP_UPLOAD:-25M}"
PHP_POST="${PHP_POST:-30M}"
NGINX_BODY="${NGINX_BODY:-30m}"

echo "==> [1/9] Roundcube attachment + SMTP includes"
mkdir -p "${RC_ROOT}/config" "${RC_ROOT}/temp"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
for f in smtp-transport.inc.php attachments-mime.inc.php; do
  if [[ -f "${REPO_ROOT}/roundcube/config/${f}" ]]; then
    cp -a "${REPO_ROOT}/roundcube/config/${f}" "${RC_ROOT}/config/${f}"
  fi
done
# Inline attachments snippet if repo copy missing
if [[ ! -f "${RC_ROOT}/config/attachments-mime.inc.php" ]]; then
  cat > "${RC_ROOT}/config/attachments-mime.inc.php" <<'PHP'
<?php
$config['max_message_size'] = '25M';
$config['temp_dir'] = RCUBE_INSTALL_PATH . 'temp/';
$config['force_7bit'] = false;
$config['smtp_helo_host'] = 'mail.theglobalorbit.com';
PHP
fi

CFG="${RC_ROOT}/config/config.inc.php"
if [[ -f "$CFG" ]]; then
  TS="$(date +%Y%m%d%H%M%S)"
  cp -a "$CFG" "${CFG}.bak.delivery.${TS}"
  python3 - <<'PY' "$CFG"
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()
for inc in ("smtp-transport.inc.php", "attachments-mime.inc.php"):
    needle = f"include __DIR__ . '/{inc}';"
    if needle not in text and f"'{inc}'" not in text:
        text = text.rstrip() + f"\n{needle}\n"
open(path, "w", encoding="utf-8").write(text)
print("includes ok")
PY
  chown -R www-data:www-data "${RC_ROOT}/temp" 2>/dev/null || chown -R apache:apache "${RC_ROOT}/temp" 2>/dev/null || true
  chmod 775 "${RC_ROOT}/temp" || true
  php -l "$CFG" || true
fi

echo "==> [2/9] PHP upload limits (${PHP_UPLOAD} / ${PHP_POST})"
PHP_INI_DIR="/etc/php"
if [[ -d "$PHP_INI_DIR" ]]; then
  while IFS= read -r ini; do
    [[ -z "$ini" ]] && continue
    conf_dir="$(dirname "$ini")/conf.d"
    mkdir -p "$conf_dir"
    cat > "${conf_dir}/99-orbit-mail-uploads.ini" <<EOF
; GLOBAL ORBIT MAIL — attachment uploads
upload_max_filesize = ${PHP_UPLOAD}
post_max_size = ${PHP_POST}
max_file_uploads = 50
memory_limit = 256M
max_execution_time = 120
max_input_time = 120
file_uploads = On
EOF
    echo "    wrote ${conf_dir}/99-orbit-mail-uploads.ini"
  done < <(find /etc/php -type f -name php.ini 2>/dev/null | head -n 20)
fi

echo "==> [3/9] Nginx client_max_body_size ${NGINX_BODY}"
if command -v nginx >/dev/null 2>&1; then
  mkdir -p /etc/nginx/conf.d
  cat > /etc/nginx/conf.d/orbit-mail-uploads.conf <<EOF
# GLOBAL ORBIT MAIL — Roundcube attachment uploads
client_max_body_size ${NGINX_BODY};
client_body_timeout 120s;
EOF
  nginx -t && systemctl reload nginx || true
fi

echo "==> [4/9] Postfix message_size_limit + HELO/PTR alignment"
if command -v postconf >/dev/null 2>&1; then
  postconf -e "message_size_limit = ${MSG_BYTES}"
  postconf -e "mailbox_size_limit = 0"
  # Critical for Gmail/Outlook/Yahoo: EHLO hostname must match reverse DNS
  postconf -e "myhostname = ${PTR_HOSTNAME}"
  postconf -e "smtp_helo_name = ${PTR_HOSTNAME}"
  # Gmail 550 5.7.1 IPv6AuthError when IPv6 lacks PTR/SPF
  postconf -e "inet_protocols = ipv4"
  postconf -e "soft_bounce = no"
  # Enable DSN bounce to senders
  postconf -e "notify_classes = resource, software, bounce, delay"
  postfix check 2>/dev/null || true
  systemctl restart postfix || service postfix restart || true
  echo "    myhostname=$(postconf -h myhostname)"
  echo "    message_size_limit=$(postconf -h message_size_limit)"
  echo "    inet_protocols=$(postconf -h inet_protocols)"
  echo "    PTR expected: ${PTR_HOSTNAME} (verify: dig -x ${MAIL_IP} +short)"
fi

echo "==> [5/9] OpenDKIM / signing"
if systemctl is-active --quiet opendkim 2>/dev/null || pgrep -x opendkim >/dev/null 2>&1; then
  echo "    OpenDKIM is running"
  postconf -hsmtpd_milters 2>/dev/null || true
  postconf -h non_smtpd_milters 2>/dev/null || true
else
  echo "    WARN: OpenDKIM not detected — external delivery will be inconsistent without DKIM"
  echo "    Install/configure OpenDKIM for each hosted domain (selector orbit or dkim)."
fi

echo "==> [6/9] Dovecot quota plugin (status only)"
if command -v doveconf >/dev/null 2>&1; then
  doveconf -n mail_plugins 2>/dev/null | head -n 5 || true
  doveconf -n plugin 2>/dev/null | grep -i quota | head -n 20 || echo "    (no quota plugin lines)"
fi

echo "==> [7/9] Mail queue"
if command -v mailq >/dev/null 2>&1; then
  mailq | tail -n 30 || true
  deferred="$(mailq 2>/dev/null | grep -c 'Deferred' || true)"
  echo "    deferred_hint_lines=${deferred}"
fi

echo "==> [8/9] TLS on submission/smtps"
if command -v postconf >/dev/null 2>&1; then
  postconf -h smtpd_tls_cert_file smtpd_tls_key_file smtpd_tls_security_level 2>/dev/null || true
fi

echo "==> [9/9] Reload PHP-FPM"
systemctl reload php8.3-fpm 2>/dev/null \
  || systemctl reload php8.2-fpm 2>/dev/null \
  || systemctl reload php8.1-fpm 2>/dev/null \
  || systemctl reload php-fpm 2>/dev/null \
  || true

# Also raise Roundcube-visible limit note in config (must match PHP 25M after harden)
if [[ -f "${RC_ROOT}/config/config.inc.php" ]]; then
  grep -q "max_message_size" "${RC_ROOT}/config/config.inc.php" "${RC_ROOT}/config/attachments-mime.inc.php" 2>/dev/null \
    && echo "    Roundcube max_message_size present" \
    || echo "    WARN: ensure attachments-mime.inc.php is included"
fi

# Prove PHP no longer stuck at 8M (root cause of Roundcube attachment failures)
php -r '
$u = ini_get("upload_max_filesize");
$p = ini_get("post_max_size");
echo "PHP upload_max_filesize={$u} post_max_size={$p}\n";
$bytes = function($v) {
  $v = trim($v); $u = strtolower(substr($v,-1)); $n = (float)$v;
  return (int)($u==="g"?$n*1073741824:($u==="m"?$n*1048576:($u==="k"?$n*1024:$n)));
};
if ($bytes($u) < 20*1048576) { fwrite(STDERR, "FAIL: upload_max_filesize still < 20M (was often 8M)\n"); exit(2); }
echo "PHP upload limits OK for Workspace-class attachments\n";
' || true

cat <<EOF

DONE — attachment + delivery harden applied.

CRITICAL DNS / IDENTITY (must be true for Gmail/Outlook/Yahoo):
  1) dig -x ${MAIL_IP} +short   → must equal Postfix myhostname (${PTR_HOSTNAME})
  2) Each customer domain needs:
       MX  → ${PUBLIC_MAIL_HOSTNAME}
       SPF → v=spf1 mx a:${PUBLIC_MAIL_HOSTNAME} ip4:${MAIL_IP} -all
       DKIM → orbit._domainkey (or opendkim selector) TXT published
       DMARC → _dmarc TXT (p=none then quarantine)
  3) zenspanp.com currently missing DKIM in public DNS — publish Orbit DKIM TXT

Test:
  echo test | mail -s 'orbit-queue-test' you@gmail.com
  Roundcube: send PDF/ZIP/image ≤ 20MB
  mailq ; tail -n 100 /var/log/mail.log
EOF
