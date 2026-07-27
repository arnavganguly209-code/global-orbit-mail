#!/usr/bin/env bash
# GLOBAL ORBIT MAIL — VPS mail agent (production)
# Install: /opt/global-orbit/bin/mail-agent.sh && chmod 755
#
# Dovecot authenticates against MariaDB/MySQL:
#   Database: mailserver
#   Table:    virtual_users
#   Query:    SELECT email,password FROM virtual_users WHERE email='%u'
#   Scheme:   SHA512-CRYPT ($6$…)
#
# Orbit (PostgreSQL/Prisma) is the control plane. This agent keeps MariaDB + Maildir in sync.
set -euo pipefail

COMMAND="${1:-}"
PAYLOAD="${MAIL_AGENT_PAYLOAD:-{}}"

VMAIL_BASE="${VMAIL_BASE:-/var/mail/vhosts}"
VMAIL_UID="${VMAIL_UID:-5000}"
VMAIL_GID="${VMAIL_GID:-5000}"
MAIL_MYSQL_DATABASE="${MAIL_MYSQL_DATABASE:-mailserver}"

json_ok() {
  local data="${1:-{}}"
  printf '{"ok":true,"data":%s}\n' "$data"
}

json_err() {
  local msg="$1"
  printf '{"ok":false,"error":%s}\n' "$(printf '%s' "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
  exit 1
}

field() {
  local key="$1"
  printf '%s' "$PAYLOAD" | python3 -c "
import json,sys
raw=sys.stdin.read() or '{}'
try:
  d=json.loads(raw)
except Exception:
  d={}
p=d.get('payload') if isinstance(d.get('payload'), dict) else {}
v=d.get('$key')
if v is None:
  v=p.get('$key')
print('' if v is None else v)
" 2>/dev/null || true
}

sql_escape() {
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])'
}

detect_scheme() {
  local scheme=""
  if command -v doveconf >/dev/null 2>&1; then
    scheme="$(doveconf -h auth_default_scheme 2>/dev/null || true)"
    if [[ -z "$scheme" ]]; then
      scheme="$(doveconf -h default_pass_scheme 2>/dev/null || true)"
    fi
  fi
  if [[ -z "$scheme" && -r /etc/dovecot/dovecot-sql.conf.ext ]]; then
    scheme="$(awk -F= '/^default_pass_scheme/{gsub(/[[:space:]]/,"",$2); print $2; exit}' /etc/dovecot/dovecot-sql.conf.ext 2>/dev/null || true)"
  fi
  printf '%s' "${scheme:-SHA512-CRYPT}"
}

# Load MySQL credentials from env or dovecot-sql.conf.ext
load_mysql_env() {
  if [[ -n "${MAIL_MYSQL_HOST:-}" && -n "${MAIL_MYSQL_USER:-}" ]]; then
    return 0
  fi
  if [[ -n "${MAIL_MYSQL_URL:-}" ]]; then
    # mysql://user:pass@host:3306/mailserver
    eval "$(python3 - <<'PY'
import os, urllib.parse, shlex
u = urllib.parse.urlparse(os.environ.get("MAIL_MYSQL_URL",""))
if u.scheme.startswith("mysql"):
  db=(u.path or '/mailserver').lstrip('/') or 'mailserver'
  print(f"export MAIL_MYSQL_HOST={shlex.quote(u.hostname or '127.0.0.1')}")
  print(f"export MAIL_MYSQL_PORT={shlex.quote(str(u.port or 3306))}")
  print(f"export MAIL_MYSQL_USER={shlex.quote(urllib.parse.unquote(u.username or ''))}")
  print(f"export MAIL_MYSQL_PASSWORD={shlex.quote(urllib.parse.unquote(u.password or ''))}")
  print(f"export MAIL_MYSQL_DATABASE={shlex.quote(db)}")
PY
)"
    return 0
  fi

  if [[ -r /etc/dovecot/dovecot-sql.conf.ext ]]; then
    local connect
    connect="$(awk -F= '/^connect/{sub(/^[^=]+=/,""); gsub(/^[[:space:]]+|[[:space:]]+$/,""); print; exit}' /etc/dovecot/dovecot-sql.conf.ext 2>/dev/null || true)"
    if [[ -n "$connect" ]]; then
      # host=.. dbname=.. / database=.. user=.. password=..
      MAIL_MYSQL_HOST="$(printf '%s' "$connect" | sed -n 's/.*host=\([^ ]*\).*/\1/p')"
      MAIL_MYSQL_PORT="$(printf '%s' "$connect" | sed -n 's/.*port=\([^ ]*\).*/\1/p')"
      MAIL_MYSQL_USER="$(printf '%s' "$connect" | sed -n 's/.*user=\([^ ]*\).*/\1/p')"
      MAIL_MYSQL_PASSWORD="$(printf '%s' "$connect" | sed -n 's/.*password=\([^ ]*\).*/\1/p')"
      MAIL_MYSQL_DATABASE="$(printf '%s' "$connect" | sed -n 's/.*dbname=\([^ ]*\).*/\1/p')"
      if [[ -z "$MAIL_MYSQL_DATABASE" ]]; then
        MAIL_MYSQL_DATABASE="$(printf '%s' "$connect" | sed -n 's/.*database=\([^ ]*\).*/\1/p')"
      fi
      export MAIL_MYSQL_HOST MAIL_MYSQL_PORT MAIL_MYSQL_USER MAIL_MYSQL_PASSWORD
      export MAIL_MYSQL_DATABASE="${MAIL_MYSQL_DATABASE:-mailserver}"
      export MAIL_MYSQL_PORT="${MAIL_MYSQL_PORT:-3306}"
    fi
  fi
}

mysql_exec() {
  local sql="$1"
  load_mysql_env
  if [[ -z "${MAIL_MYSQL_USER:-}" ]]; then
    return 1
  fi
  local client=""
  if command -v mysql >/dev/null 2>&1; then
    client="mysql"
  elif command -v mariadb >/dev/null 2>&1; then
    client="mariadb"
  else
    return 1
  fi
  MYSQL_PWD="${MAIL_MYSQL_PASSWORD:-}" "$client" \
    -h "${MAIL_MYSQL_HOST:-127.0.0.1}" \
    -P "${MAIL_MYSQL_PORT:-3306}" \
    -u "${MAIL_MYSQL_USER}" \
    "${MAIL_MYSQL_DATABASE:-mailserver}" \
    -N -e "$sql"
}

ensure_mysql_tables() {
  mysql_exec "
CREATE TABLE IF NOT EXISTS virtual_domains (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS virtual_users (
  id INT NOT NULL AUTO_INCREMENT,
  domain_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  KEY domain_id (domain_id),
  CONSTRAINT fk_virtual_users_domain FOREIGN KEY (domain_id)
    REFERENCES virtual_domains (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
" || true
}

upsert_virtual_user() {
  local email="$1" hash="$2"
  local domain
  domain="${email#*@}"
  ensure_mysql_tables
  local e d h
  e="$(sql_escape "$email")"
  d="$(sql_escape "$domain")"
  h="$(sql_escape "$hash")"

  # Strip {SHA512-CRYPT} prefix — store $6$… for default_pass_scheme=SHA512-CRYPT
  if [[ "$hash" == \{SHA512-CRYPT\}* ]]; then
    hash="${hash#\{SHA512-CRYPT\}}"
    h="$(sql_escape "$hash")"
  fi

  mysql_exec "INSERT INTO virtual_domains (name) VALUES ('$d') ON DUPLICATE KEY UPDATE name=VALUES(name);"
  mysql_exec "
INSERT INTO virtual_users (email, password, domain_id)
SELECT '$e', '$h', id FROM virtual_domains WHERE name='$d' LIMIT 1
ON DUPLICATE KEY UPDATE password=VALUES(password), domain_id=VALUES(domain_id);
"
  # Prove the row exists
  local found
  found="$(mysql_exec "SELECT email FROM virtual_users WHERE email='$e' LIMIT 1;" || true)"
  [[ -n "$found" ]]
}

provision_mailbox_auth() {
  local email="$1" plain="$2" provided_hash="$3" action="$4"
  local hash home AUTH_OUT AUTH_RC hash_json auth_json

  hash="$(hash_password_for_dovecot "$plain" "$provided_hash" || true)"
  if [[ -z "$hash" || "$hash" != \$6\$* ]]; then
    json_err "Unable to produce SHA512-CRYPT hash (need doveadm/openssl or \$6\$ mailPasswordHash)"
  fi

  home="$(ensure_maildir "$email")"
  if ! upsert_virtual_user "$email" "$hash"; then
    json_err "Failed writing MariaDB mailserver.virtual_users (set MAIL_MYSQL_* or dovecot-sql.conf.ext)"
  fi

  if [[ -n "$plain" ]]; then
    set +e
    AUTH_OUT="$(doveadm auth test "$email" "$plain" 2>&1)"
    AUTH_RC=$?
    set -e
    # Dovecot 2.3 variants: "user authenticated" OR "auth succeeded"
    if ! echo "$AUTH_OUT" | grep -Eqi 'passdb:.*user authenticated|passdb:.*auth succeeded|\bauth succeeded\b'; then
      json_err "doveadm auth test failed (rc=$AUTH_RC): $AUTH_OUT"
    fi
  else
    AUTH_OUT="hash-only sync (no doveadm auth test)"
  fi

  # Apply quota when Orbit sends quotaBytes (commercial multi-domain)
  local quota_bytes
  quota_bytes="$(field quotaBytes)"
  if [[ -n "$quota_bytes" && "$quota_bytes" =~ ^[0-9]+$ && "$quota_bytes" -gt 0 ]]; then
    apply_mailbox_quota "$email" "$quota_bytes" || true
  fi

  ensure_special_folders "$email" || true

  hash_json="$(printf '%s' "$hash" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
  auth_json="$(printf '%s' "$AUTH_OUT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
  local auth_flag="false"
  if [[ -n "$plain" ]]; then auth_flag="true"; fi
  json_ok "{\"email\":\"$email\",\"action\":\"$action\",\"home\":\"$home\",\"scheme\":\"SHA512-CRYPT\",\"mailPasswordHash\":$hash_json,\"mysqlSynced\":true,\"sqlSynced\":true,\"authTest\":$auth_flag,\"authOutput\":$auth_json,\"quotaBytes\":${quota_bytes:-0}}"
}

hash_password_for_dovecot() {
  local plain="$1"
  local provided_hash="$2"
  local scheme out

  scheme="$(detect_scheme)"
  # Force SHA512-CRYPT — production Dovecot MySQL passdb requirement
  if [[ "$scheme" != "SHA512-CRYPT" && "$scheme" != "CRYPT" ]]; then
    scheme="SHA512-CRYPT"
  fi

  if [[ -n "$plain" ]] && command -v doveadm >/dev/null 2>&1; then
    out="$(doveadm pw -s SHA512-CRYPT -p "$plain" | tr -d '\r\n')"
    # Normalize to $6$…
    out="${out#\{SHA512-CRYPT\}}"
    printf '%s' "$out"
    return
  fi

  if [[ -n "$plain" ]] && command -v openssl >/dev/null 2>&1; then
    out="$(openssl passwd -6 "$plain" | tr -d '\r\n')"
    printf '%s' "$out"
    return
  fi

  if [[ -n "$provided_hash" ]]; then
    out="${provided_hash#\{SHA512-CRYPT\}}"
    if [[ "$out" == \$6\$* ]]; then
      printf '%s' "$out"
      return
    fi
  fi

  return 1
}

ensure_maildir() {
  local email="$1"
  local localpart domain home
  localpart="${email%@*}"
  domain="${email#*@}"
  home="${VMAIL_BASE}/${domain}/${localpart}"

  mkdir -p \
    "${home}/cur" "${home}/new" "${home}/tmp" \
    "${home}/.Drafts/cur" "${home}/.Drafts/new" "${home}/.Drafts/tmp" \
    "${home}/.Sent/cur" "${home}/.Sent/new" "${home}/.Sent/tmp" \
    "${home}/.Junk/cur" "${home}/.Junk/new" "${home}/.Junk/tmp" \
    "${home}/.Trash/cur" "${home}/.Trash/new" "${home}/.Trash/tmp"

  if id -u "vmail" >/dev/null 2>&1; then
    chown -R "vmail:vmail" "${VMAIL_BASE}/${domain}" 2>/dev/null || chown -R "${VMAIL_UID}:${VMAIL_GID}" "${VMAIL_BASE}/${domain}" 2>/dev/null || true
  else
    chown -R "${VMAIL_UID}:${VMAIL_GID}" "${VMAIL_BASE}/${domain}" 2>/dev/null || true
  fi
  chmod -R u+rwX,g+rwX,o-rwx "${home}" 2>/dev/null || true
  printf '%s' "$home"
}

# Create + subscribe IMAP special folders (Roundcube / Workspace-class)
ensure_special_folders() {
  local email="$1"
  local box
  if ! command -v doveadm >/dev/null 2>&1; then
    return 0
  fi
  for box in Drafts Sent Junk Trash; do
    doveadm mailbox create -u "$email" "$box" 2>/dev/null || true
    doveadm mailbox subscribe -u "$email" "$box" 2>/dev/null || true
  done
  # subscriptions file fallback for clients that don't use LIST-EXTENDED
  local home localpart domain sub
  localpart="${email%@*}"
  domain="${email#*@}"
  home="${VMAIL_BASE}/${domain}/${localpart}"
  sub="${home}/subscriptions"
  if [[ -d "$home" ]]; then
    {
      echo "INBOX"
      echo "Drafts"
      echo "Sent"
      echo "Junk"
      echo "Trash"
    } > "$sub"
    chown "${VMAIL_UID}:${VMAIL_GID}" "$sub" 2>/dev/null || true
  fi
}

apply_mailbox_quota() {
  local email="$1"
  local bytes="$2"
  local e kb
  e="$(sql_escape "$email")"
  kb=$((bytes / 1024))
  [[ "$kb" -lt 1 ]] && kb=1

  ensure_mysql_tables
  mysql_exec "ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS quota BIGINT NOT NULL DEFAULT 0;" 2>/dev/null \
    || mysql_exec "ALTER TABLE virtual_users ADD COLUMN quota BIGINT NOT NULL DEFAULT 0;" 2>/dev/null \
    || true
  mysql_exec "UPDATE virtual_users SET quota=${bytes} WHERE email='$e';" 2>/dev/null || true

  if command -v doveadm >/dev/null 2>&1; then
    doveadm quota set -u "$email" STORAGE "$kb" 2>/dev/null \
      || doveadm quota set -u "$email" -k STORAGE "$kb" 2>/dev/null \
      || true
  fi
}

# Install Orbit-generated DKIM private key into OpenDKIM (no second keygen)
sync_opendkim() {
  local domain="$1" selector="$2" pem="$3" public="$4"
  local OPENDKIM_DIR KEYS_DIR priv kt st td
  OPENDKIM_DIR="${OPENDKIM_DIR:-/etc/opendkim}"
  KEYS_DIR="${OPENDKIM_KEYS_DIR:-${OPENDKIM_DIR}/keys}"

  if [[ -z "$domain" || -z "$selector" || -z "$pem" ]]; then
    json_err "dkim.sync requires domain, selector, privateKeyPem"
  fi

  if [[ ! -d "$OPENDKIM_DIR" ]] && ! command -v opendkim >/dev/null 2>&1; then
    json_err "OpenDKIM is not installed on mail host (apt install opendkim opendkim-tools). Required for commercial multi-domain signing."
  fi

  mkdir -p "${KEYS_DIR}/${domain}" "$OPENDKIM_DIR"
  priv="${KEYS_DIR}/${domain}/${selector}.private"
  printf '%s' "$pem" | python3 -c '
import sys
t = sys.stdin.read()
t = t.replace("\\\\n", "\n").replace("\\n", "\n")
if "BEGIN" not in t:
  raise SystemExit("invalid private key PEM")
path = sys.argv[1]
open(path, "w", encoding="utf-8").write(t if t.endswith("\n") else t + "\n")
' "$priv"
  chmod 600 "$priv"
  chown opendkim:opendkim "$priv" 2>/dev/null || chown root:root "$priv" || true

  if [[ -n "$public" ]]; then
    printf 'v=DKIM1; k=rsa; p=%s\n' "$public" > "${KEYS_DIR}/${domain}/${selector}.txt"
  fi

  kt="${OPENDKIM_DIR}/KeyTable"
  st="${OPENDKIM_DIR}/SigningTable"
  td="${OPENDKIM_DIR}/TrustedHosts"
  touch "$kt" "$st" "$td"
  # Idempotent replace for this selector/domain
  grep -v "${selector}._domainkey.${domain}" "$kt" > "${kt}.tmp" 2>/dev/null || true
  mv "${kt}.tmp" "$kt" 2>/dev/null || true
  echo "${selector}._domainkey.${domain} ${domain}:${selector}:${priv}" >> "$kt"

  grep -v "[[:space:]]${domain}\$" "$st" > "${st}.tmp" 2>/dev/null || true
  grep -v "@${domain}" "${st}.tmp" > "${st}.tmp2" 2>/dev/null || cp "$st" "${st}.tmp2"
  mv "${st}.tmp2" "$st" 2>/dev/null || true
  rm -f "${st}.tmp"
  echo "*@${domain} ${selector}._domainkey.${domain}" >> "$st"

  grep -qxF "127.0.0.1" "$td" 2>/dev/null || echo "127.0.0.1" >> "$td"
  grep -qxF "localhost" "$td" 2>/dev/null || echo "localhost" >> "$td"
  grep -qxF "$domain" "$td" 2>/dev/null || echo "$domain" >> "$td"

  # Ensure Postfix milters point at OpenDKIM only when :8891 is live
  # (hung milter → Roundcube "Failed to reach the server!")
  if command -v postconf >/dev/null 2>&1; then
    if ss -tlnp 2>/dev/null | grep -q ':8891 ' || netstat -tlnp 2>/dev/null | grep -q ':8891 '; then
      local milters
      milters="$(postconf -h smtpd_milters 2>/dev/null || true)"
      if [[ "$milters" != *8891* && "$milters" != *opendkim* ]]; then
        postconf -e "smtpd_milters = inet:127.0.0.1:8891"
        postconf -e "non_smtpd_milters = inet:127.0.0.1:8891"
        postconf -e "milter_default_action = accept"
        postconf -e "milter_connect_timeout = 5s"
        systemctl reload postfix 2>/dev/null || true
      fi
    else
      echo "[mail-agent] OpenDKIM :8891 not listening — not enabling milters" >&2
    fi
  fi

  systemctl restart opendkim 2>/dev/null || service opendkim restart 2>/dev/null || true
}

# One-shot commercial platform limits (idempotent) — no manual harden needed per domain

# Gmail rejects unsigned/unaligned IPv6 with 550 5.7.1 IPv6AuthError when PTR/SPF ip6 missing.
ensure_postfix_ipv4_only() {
  local ipv6="${MAIL_SERVER_IPV6:-2a02:4780:63:1d79::1}"
  local force="${MAIL_FORCE_IPV4:-auto}"
  local ptr6="" spf_ok=0

  if [[ "$force" == "ipv4" || "$force" == "1" || "$force" == "true" ]]; then
    postconf -e "inet_protocols = ipv4"
    echo "[mail-agent] inet_protocols=ipv4 (forced via MAIL_FORCE_IPV4)" >&2
    return 0
  fi

  if [[ "$force" == "all" ]]; then
    postconf -e "inet_protocols = all"
    echo "[mail-agent] inet_protocols=all (forced)" >&2
    return 0
  fi

  # auto: require IPv6 PTR + SPF ip6: before allowing dual-stack outbound
  ptr6="$(dig -x "$ipv6" +short 2>/dev/null | sed 's/\.$//' | head -n1 || true)"
  if [[ -z "$ptr6" ]]; then
    postconf -e "inet_protocols = ipv4"
    echo "[mail-agent] inet_protocols=ipv4 (no PTR for ${ipv6} — prevents Gmail IPv6AuthError)" >&2
    return 0
  fi

  # SPF on primary mail identity must authorize ip6
  if dig +short TXT theglobalorbit.com 2>/dev/null | tr -d '"' | grep -qi "ip6:${ipv6}"; then
    spf_ok=1
  elif dig +short TXT globalorbitmail.cloud 2>/dev/null | tr -d '"' | grep -qi "ip6:"; then
    spf_ok=1
  fi
  if [[ "$spf_ok" -ne 1 ]]; then
    postconf -e "inet_protocols = ipv4"
    echo "[mail-agent] inet_protocols=ipv4 (IPv6 PTR=${ptr6} but SPF lacks ip6 — Gmail IPv6AuthError risk)" >&2
    return 0
  fi

  postconf -e "inet_protocols = all"
  echo "[mail-agent] inet_protocols=all (IPv6 PTR+SPF look ready)" >&2
}

platform_ensure() {
  local MSG_BYTES=26214400
  local PHP_UPLOAD=25M
  local PHP_POST=30M
  local NGINX_BODY=30m
  local PTR_HOSTNAME RC_ROOT

  PTR_HOSTNAME="${PTR_HOSTNAME:-$(dig -x "${MAIL_SERVER_IPV4:-200.97.170.235}" +short 2>/dev/null | sed 's/\.$//' | head -n1)}"
  PTR_HOSTNAME="${PTR_HOSTNAME:-mail.theglobalorbit.com}"
  RC_ROOT="${ORBIT_ROUNDCUBE_ROOT:-/var/www/roundcube}"

  # PHP uploads (fixes Roundcube "exceeds 8.0 MB") — write ALL conf.d (cli+fpm+apache2)
  if [[ -d /etc/php ]]; then
    while IFS= read -r conf_dir; do
      [[ -z "$conf_dir" || ! -d "$conf_dir" ]] && continue
      cat > "${conf_dir}/99-orbit-mail-uploads.ini" <<EOF
upload_max_filesize = ${PHP_UPLOAD}
post_max_size = ${PHP_POST}
max_file_uploads = 50
memory_limit = 256M
max_execution_time = 180
max_input_time = 180
file_uploads = On
EOF
    done < <(find /etc/php -type d -name conf.d 2>/dev/null)
    while IFS= read -r ini; do
      [[ -z "$ini" || ! -f "$ini" ]] && continue
      sed -i.bak-orbit \
        -e "s/^[; ]*upload_max_filesize=.*/upload_max_filesize = ${PHP_UPLOAD}/" \
        -e "s/^[; ]*post_max_size=.*/post_max_size = ${PHP_POST}/" \
        "$ini" 2>/dev/null || true
    done < <(find /etc/php -type f -name php.ini 2>/dev/null)
  fi

  if command -v nginx >/dev/null 2>&1; then
    mkdir -p /etc/nginx/conf.d
    cat > /etc/nginx/conf.d/orbit-mail-uploads.conf <<EOF
client_max_body_size ${NGINX_BODY};
client_body_buffer_size 1m;
client_body_timeout 180s;
EOF
    find /etc/nginx -type f -name '*.conf' -print0 2>/dev/null \
      | xargs -0 sed -i.bak-orbit -E "s/client_max_body_size[[:space:]]+[^;]+;/client_max_body_size ${NGINX_BODY};/g" 2>/dev/null || true
    while IFS= read -r conf; do
      [[ -z "$conf" || "$conf" == *orbit-mail-uploads.conf ]] && continue
      if grep -qE 'server\s*\{' "$conf" && ! grep -q 'client_max_body_size' "$conf"; then
        sed -i.bak-orbit -E "0,/server[[:space:]]*\{/s//server {\n    client_max_body_size ${NGINX_BODY};/" "$conf" 2>/dev/null || true
      fi
    done < <(find /etc/nginx -type f -name '*.conf' 2>/dev/null)
    nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
  fi

  if command -v postconf >/dev/null 2>&1; then
    postconf -e "message_size_limit = ${MSG_BYTES}"
    postconf -e "mailbox_size_limit = 0"
    postconf -e "myhostname = ${PTR_HOSTNAME}"
    postconf -e "smtp_helo_name = ${PTR_HOSTNAME}"
    postconf -e "soft_bounce = no"
    postconf -e "smtp_tls_security_level = may"
    postconf -e "smtpd_tls_security_level = may"
    postconf -e "always_add_missing_headers = yes"
    postconf -e "smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, defer_unauth_destination"
    # Gmail 550 5.7.1 IPv6AuthError: host IPv6 lacks PTR/SPF. Force IPv4 outbound/inbound SMTP.
    # MX hosts have A-only (no AAAA), so inbound mail stays on IPv4.
    ensure_postfix_ipv4_only
    systemctl reload postfix 2>/dev/null || true
  fi

  if [[ -d "$RC_ROOT/config" ]]; then
    mkdir -p "$RC_ROOT/temp"
    chown -R www-data:www-data "$RC_ROOT/temp" 2>/dev/null || true
    chmod 775 "$RC_ROOT/temp" 2>/dev/null || true
    if [[ ! -f "$RC_ROOT/config/attachments-mime.inc.php" ]]; then
      cat > "$RC_ROOT/config/attachments-mime.inc.php" <<'PHP'
<?php
$config['max_message_size'] = '25M';
$config['temp_dir'] = 'temp/';
$config['force_7bit'] = false;
$config['smtp_helo_host'] = 'mail.globalorbitmail.cloud';
PHP
    fi
    if [[ -f "$RC_ROOT/config/config.inc.php" ]] && ! grep -q "attachments-mime.inc.php" "$RC_ROOT/config/config.inc.php"; then
      echo "include __DIR__ . '/attachments-mime.inc.php';" >> "$RC_ROOT/config/config.inc.php"
    fi
  fi

  systemctl reload php8.3-fpm 2>/dev/null || systemctl reload php8.2-fpm 2>/dev/null || systemctl reload php8.1-fpm 2>/dev/null || true
}

case "$COMMAND" in
  domain.create)
    domain="$(field domain)"
    domain="$(printf '%s' "$domain" | tr '[:upper:]' '[:lower:]')"
    if [[ -z "$domain" ]]; then
      json_err "domain.create requires domain"
    fi
    # Idempotent platform harden (PHP/Nginx/Postfix sizes + HELO) — unlimited domains, no manual VPS
    platform_ensure || true
    mkdir -p "${VMAIL_BASE}/${domain}"
    ensure_mysql_tables
    d="$(sql_escape "$domain")"
    if ! mysql_exec "INSERT INTO virtual_domains (name) VALUES ('$d') ON DUPLICATE KEY UPDATE name=VALUES(name);"; then
      json_err "Failed writing MariaDB virtual_domains"
    fi
    if id -u "vmail" >/dev/null 2>&1; then
      chown -R "vmail:vmail" "${VMAIL_BASE}/${domain}" 2>/dev/null || true
    fi
    json_ok "{\"domain\":\"$domain\",\"action\":\"domain.create\",\"mysqlSynced\":true,\"platformEnsured\":true}"
    ;;
  domain.delete)
    domain="$(field domain)"
    domain="$(printf '%s' "$domain" | tr '[:upper:]' '[:lower:]')"
    if [[ -n "$domain" ]]; then
      ensure_mysql_tables
      d="$(sql_escape "$domain")"
      # Best-effort: remove users for domain then domain row
      mysql_exec "DELETE vu FROM virtual_users vu INNER JOIN virtual_domains vd ON vu.domain_id=vd.id WHERE vd.name='$d';" || true
      mysql_exec "DELETE FROM virtual_domains WHERE name='$d';" || true
    fi
    json_ok "{\"domain\":\"$domain\",\"action\":\"domain.delete\",\"mysqlSynced\":true}"
    ;;
  mailbox.create|mailbox.password|mailbox.restore)
    email="$(field email)"
    email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
    plain="$(field password)"
    provided_hash="$(field mailPasswordHash)"

    if [[ -z "$email" || "$email" != *"@"* ]]; then
      json_err "mailbox.create requires email"
    fi

    provision_mailbox_auth "$email" "$plain" "$provided_hash" "$COMMAND"
    ;;
  mailbox.delete|mailbox.suspend)
    email="$(field email)"
    email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
    e="$(sql_escape "$email")"
    ensure_mysql_tables
    # Prefer delete so SELECT email,password finds nothing
    mysql_exec "DELETE FROM virtual_users WHERE email='$e';" || true
    json_ok "{\"email\":\"$email\",\"action\":\"$COMMAND\",\"mysqlSynced\":true}"
    ;;
  mailbox.unsuspend)
    email="$(field email)"
    email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
    plain="$(field password)"
    provided_hash="$(field mailPasswordHash)"
    if [[ -n "$plain" || "$provided_hash" == \$6\$* || "$provided_hash" == \{SHA512-CRYPT\}* ]]; then
      provision_mailbox_auth "$email" "$plain" "$provided_hash" "mailbox.unsuspend"
    else
      json_ok "{\"email\":\"$email\",\"action\":\"mailbox.unsuspend\",\"mysqlSynced\":false,\"note\":\"reset password to restore MariaDB row\"}"
    fi
    ;;
  mailbox.quota)
    email="$(field email)"
    email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
    quota_bytes="$(field quotaBytes)"
    if [[ -z "$email" || -z "$quota_bytes" || ! "$quota_bytes" =~ ^[0-9]+$ ]]; then
      json_err "mailbox.quota requires email and quotaBytes"
    fi
    apply_mailbox_quota "$email" "$quota_bytes"
    json_ok "{\"email\":\"$email\",\"action\":\"mailbox.quota\",\"quotaBytes\":${quota_bytes},\"mysqlSynced\":true}"
    ;;
  alias.sync|forwarder.sync)
    address="$(field address)"
    goto="$(field goto)"
    address="$(printf '%s' "$address" | tr '[:upper:]' '[:lower:]')"
    goto="$(printf '%s' "$goto" | tr '[:upper:]' '[:lower:]')"
    if [[ -n "$address" && -n "$goto" ]]; then
      a="$(sql_escape "$address")"
      g="$(sql_escape "$goto")"
      ensure_mysql_tables
      mysql_exec "
CREATE TABLE IF NOT EXISTS virtual_aliases (
  id INT NOT NULL AUTO_INCREMENT,
  source VARCHAR(255) NOT NULL,
  destination TEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" || true
      mysql_exec "INSERT INTO virtual_aliases (source, destination) VALUES ('$a','$g') ON DUPLICATE KEY UPDATE destination=VALUES(destination);" || \
      mysql_exec "INSERT INTO virtual_aliases (address, goto) VALUES ('$a','$g') ON DUPLICATE KEY UPDATE goto=VALUES(goto);" || true
    fi
    json_ok "{\"action\":\"$COMMAND\",\"address\":\"$address\",\"mysqlSynced\":true}"
    ;;
  vacation.sync)
    json_ok "{\"action\":\"vacation.sync\"}"
    ;;
  dkim.sync)
    domain="$(field domain)"
    selector="$(field selector)"
    pem="$(field privateKeyPem)"
    public="$(field publicKey)"
    domain="$(printf '%s' "$domain" | tr '[:upper:]' '[:lower:]')"
    selector="$(printf '%s' "$selector" | tr '[:upper:]' '[:lower:]')"
    [[ -z "$selector" ]] && selector="orbit"
    sync_opendkim "$domain" "$selector" "$pem" "$public"
    json_ok "{\"action\":\"dkim.sync\",\"domain\":\"$domain\",\"selector\":\"$selector\",\"opendkimSynced\":true}"
    ;;
  platform.ensure)
    platform_ensure
    json_ok "{\"action\":\"platform.ensure\",\"ok\":true}"
    ;;
  storage.usage)
    email="$(field email)"
    used=0
    if command -v doveadm >/dev/null 2>&1 && [[ -n "$email" ]]; then
      used="$(doveadm quota get -u "$email" 2>/dev/null | awk '/STORAGE/{print $3; exit}' || echo 0)"
    fi
    json_ok "{\"email\":\"$email\",\"usedBytes\":${used:-0}}"
    ;;
  health.check)
    scheme="$(detect_scheme)"
    platform_ensure || true
    upload_php="$(php -r 'echo ini_get("upload_max_filesize");' 2>/dev/null || echo unknown)"
    msg_limit="unknown"
    milter="missing"
    opendkim="down"
    inet_proto="unknown"
    if command -v postconf >/dev/null 2>&1; then
      msg_limit="$(postconf -h message_size_limit 2>/dev/null || echo unknown)"
      milter="$(postconf -h smtpd_milters 2>/dev/null || echo missing)"
      inet_proto="$(postconf -h inet_protocols 2>/dev/null || echo unknown)"
    fi
    if pgrep -x opendkim >/dev/null 2>&1 || systemctl is-active --quiet opendkim 2>/dev/null; then
      opendkim="up"
    fi
    json_ok "{\"scheme\":\"$scheme\",\"vmailBase\":\"$VMAIL_BASE\",\"mysqlDatabase\":\"${MAIL_MYSQL_DATABASE:-mailserver}\",\"phpUploadMax\":\"$upload_php\",\"postfixMessageSizeLimit\":\"$msg_limit\",\"opendkim\":\"$opendkim\",\"smtpdMilters\":\"$milter\",\"inetProtocols\":\"$inet_proto\"}"
    ;;
  *)
    json_err "Unknown command: $COMMAND"
    ;;
esac
