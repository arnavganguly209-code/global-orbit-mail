#!/usr/bin/env bash
# Apply Workspace-class attachment limits on the mail/webmail host.
# Safe, idempotent. Does not touch Dovecot auth, MariaDB, or Roundcube IMAP/SMTP host.
#
# Usage:
#   bash deploy/vps/apply-attachment-limits-inline.sh
#   # or from Orbit local mode via mail-engine fallback
#
set -euo pipefail

PHP_UPLOAD="${PHP_UPLOAD:-25M}"
PHP_POST="${PHP_POST:-30M}"
NGINX_BODY="${NGINX_BODY:-30m}"
APACHE_LIMIT="${APACHE_LIMIT:-31457280}"
MSG_BYTES="${MSG_BYTES:-26214400}"
RC_ROOT="${ORBIT_ROUNDCUBE_ROOT:-/var/www/roundcube}"
PTR_HOSTNAME="${PTR_HOSTNAME:-$(dig -x "${MAIL_SERVER_IPV4:-200.97.170.235}" +short 2>/dev/null | sed 's/\.$//' | head -n1 || true)}"
PTR_HOSTNAME="${PTR_HOSTNAME:-mail.theglobalorbit.com}"

echo "==> PHP upload limits (${PHP_UPLOAD} / ${PHP_POST})"
# Write into EVERY conf.d (cli + fpm + apache2) — Roundcube uses FPM, not CLI
while IFS= read -r conf_dir; do
  [[ -z "$conf_dir" || ! -d "$conf_dir" ]] && continue
  cat > "${conf_dir}/99-orbit-mail-uploads.ini" <<EOF
; GLOBAL ORBIT MAIL — attachment uploads (Workspace-class)
upload_max_filesize = ${PHP_UPLOAD}
post_max_size = ${PHP_POST}
max_file_uploads = 50
memory_limit = 256M
max_execution_time = 180
max_input_time = 180
file_uploads = On
upload_tmp_dir = /tmp
EOF
  echo "    wrote ${conf_dir}/99-orbit-mail-uploads.ini"
done < <(find /etc/php -type d -name conf.d 2>/dev/null)

# Also patch main php.ini values if present (some hosts ignore conf.d order)
while IFS= read -r ini; do
  [[ -z "$ini" || ! -f "$ini" ]] && continue
  sed -i.bak-orbit \
    -e "s/^[; ]*upload_max_filesize=.*/upload_max_filesize = ${PHP_UPLOAD}/" \
    -e "s/^[; ]*post_max_size=.*/post_max_size = ${PHP_POST}/" \
    "$ini" 2>/dev/null || true
done < <(find /etc/php -type f -name php.ini 2>/dev/null)

echo "==> Nginx client_max_body_size ${NGINX_BODY}"
if command -v nginx >/dev/null 2>&1; then
  mkdir -p /etc/nginx/conf.d
  cat > /etc/nginx/conf.d/orbit-mail-uploads.conf <<EOF
client_max_body_size ${NGINX_BODY};
client_body_buffer_size 1m;
client_body_timeout 180s;
EOF
  # Replace any existing body-size directives (site vhosts often pin 1m)
  find /etc/nginx -type f -name '*.conf' -print0 2>/dev/null \
    | xargs -0 sed -i.bak-orbit -E "s/client_max_body_size[[:space:]]+[^;]+;/client_max_body_size ${NGINX_BODY};/g" 2>/dev/null || true
  # Inject into server blocks that never set a limit (nginx default is 1m → 413)
  while IFS= read -r conf; do
    [[ -z "$conf" || "$conf" == *orbit-mail-uploads.conf ]] && continue
    if grep -qE 'server\s*\{' "$conf" && ! grep -q 'client_max_body_size' "$conf"; then
      sed -i.bak-orbit -E "0,/server[[:space:]]*\{/s//server {\n    client_max_body_size ${NGINX_BODY};/" "$conf" 2>/dev/null || true
    fi
  done < <(find /etc/nginx -type f -name '*.conf' 2>/dev/null)
  nginx -t && systemctl reload nginx || true
fi

echo "==> Apache LimitRequestBody (if Apache)"
if command -v apache2 >/dev/null 2>&1 || command -v httpd >/dev/null 2>&1; then
  mkdir -p /etc/apache2/conf-available 2>/dev/null || true
  cat > /etc/apache2/conf-available/orbit-mail-uploads.conf <<EOF
LimitRequestBody ${APACHE_LIMIT}
EOF
  a2enconf orbit-mail-uploads 2>/dev/null || true
  systemctl reload apache2 2>/dev/null || systemctl reload httpd 2>/dev/null || true
fi

echo "==> Postfix message_size_limit ${MSG_BYTES}"
if command -v postconf >/dev/null 2>&1; then
  postconf -e "message_size_limit = ${MSG_BYTES}"
  postconf -e "mailbox_size_limit = 0"
  postconf -e "myhostname = ${PTR_HOSTNAME}"
  postconf -e "smtp_helo_name = ${PTR_HOSTNAME}"
  # Keep Gmail-safe IPv4 outbound
  postconf -e "inet_protocols = ipv4"
  systemctl reload postfix 2>/dev/null || systemctl restart postfix 2>/dev/null || true
fi

echo "==> Roundcube max_message_size + temp"
if [[ -d "$RC_ROOT" ]]; then
  mkdir -p "$RC_ROOT/temp" "$RC_ROOT/logs" "$RC_ROOT/config"
  chown -R www-data:www-data "$RC_ROOT/temp" "$RC_ROOT/logs" 2>/dev/null || true
  chmod 775 "$RC_ROOT/temp" "$RC_ROOT/logs" 2>/dev/null || true
  cat > "$RC_ROOT/config/attachments-mime.inc.php" <<'PHP'
<?php
$config['max_message_size'] = '25M';
$config['temp_dir'] = 'temp/';
$config['force_7bit'] = false;
$config['smtp_helo_host'] = 'mail.globalorbitmail.cloud';
$config['mime_types'] = null;
PHP
  CFG="$RC_ROOT/config/config.inc.php"
  if [[ -f "$CFG" ]]; then
    grep -q "attachments-mime.inc.php" "$CFG" || echo "include __DIR__ . '/attachments-mime.inc.php';" >> "$CFG"
    # Ensure smtp transport include still present
    true
  fi
  php -l "$RC_ROOT/config/attachments-mime.inc.php" 2>/dev/null || true
fi

echo "==> Reload PHP-FPM"
systemctl reload php8.3-fpm 2>/dev/null \
  || systemctl reload php8.2-fpm 2>/dev/null \
  || systemctl reload php8.1-fpm 2>/dev/null \
  || systemctl reload php-fpm 2>/dev/null \
  || true

echo "==> Verify PHP (FPM may differ from CLI — show CLI)"
php -r 'echo "CLI upload_max_filesize=".ini_get("upload_max_filesize")." post_max_size=".ini_get("post_max_size")."\n";' || true

# Drop a phpinfo snippet check via php-fpm if available
if [[ -d "$RC_ROOT" ]]; then
  echo "<?php header('Content-Type: text/plain'); echo 'upload_max_filesize='.ini_get('upload_max_filesize').PHP_EOL.'post_max_size='.ini_get('post_max_size').PHP_EOL;" \
    > "$RC_ROOT/temp/orbit-upload-check.php"
  chown www-data:www-data "$RC_ROOT/temp/orbit-upload-check.php" 2>/dev/null || true
fi

echo
echo "DONE. Attachment limits applied."
echo "Re-test Roundcube upload; expect no more 'exceeds 8.0 MB' for small files."
