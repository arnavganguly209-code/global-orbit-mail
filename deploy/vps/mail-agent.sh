#!/usr/bin/env bash
# GLOBAL ORBIT MAIL — VPS mail agent (production)
# Install: /opt/global-orbit/bin/mail-agent.sh && chmod 755
#
# Dovecot authenticates against MySQL:
#   Database: mailserver
#   Table:    virtual_users
#   Query:    SELECT email,password FROM virtual_users WHERE email='%u'
#   Scheme:   SHA512-CRYPT ($6$…)
#
# Orbit (PostgreSQL/Prisma) is the control plane. This agent keeps MySQL + Maildir in sync.
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
  if ! command -v mysql >/dev/null 2>&1; then
    return 1
  fi
  MYSQL_PWD="${MAIL_MYSQL_PASSWORD:-}" mysql \
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

case "$COMMAND" in
  domain.create)
    domain="$(field domain)"
    domain="$(printf '%s' "$domain" | tr '[:upper:]' '[:lower:]')"
    if [[ -n "$domain" ]]; then
      mkdir -p "${VMAIL_BASE}/${domain}"
      ensure_mysql_tables
      d="$(sql_escape "$domain")"
      mysql_exec "INSERT INTO virtual_domains (name) VALUES ('$d') ON DUPLICATE KEY UPDATE name=VALUES(name);" || true
      if id -u "vmail" >/dev/null 2>&1; then
        chown -R "vmail:vmail" "${VMAIL_BASE}/${domain}" 2>/dev/null || true
      fi
    fi
    json_ok "{\"domain\":\"$domain\",\"action\":\"domain.create\"}"
    ;;
  domain.delete)
    domain="$(field domain)"
    json_ok "{\"domain\":\"$domain\",\"action\":\"domain.delete\"}"
    ;;
  mailbox.create|mailbox.password)
    email="$(field email)"
    email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
    plain="$(field password)"
    provided_hash="$(field mailPasswordHash)"
    quota_bytes="$(field quotaBytes)"
    quota_bytes="${quota_bytes:-0}"

    if [[ -z "$email" || "$email" != *"@"* ]]; then
      json_err "mailbox.create requires email"
    fi

    hash="$(hash_password_for_dovecot "$plain" "$provided_hash" || true)"
    if [[ -z "$hash" || "$hash" != \$6\$* ]]; then
      json_err "Unable to produce SHA512-CRYPT hash (need doveadm/openssl or \$6\$ mailPasswordHash)"
    fi

    home="$(ensure_maildir "$email")"
    if ! upsert_virtual_user "$email" "$hash"; then
      json_err "Failed writing MySQL mailserver.virtual_users (set MAIL_MYSQL_* or dovecot-sql.conf.ext)"
    fi

    hash_json="$(printf '%s' "$hash" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
    json_ok "{\"email\":\"$email\",\"action\":\"$COMMAND\",\"home\":\"$home\",\"scheme\":\"SHA512-CRYPT\",\"mailPasswordHash\":$hash_json,\"mysqlSynced\":true,\"sqlSynced\":true}"
    ;;
  mailbox.delete|mailbox.suspend)
    email="$(field email)"
    email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
    e="$(sql_escape "$email")"
    ensure_mysql_tables
    # Prefer delete so SELECT email,password finds nothing
    mysql_exec "DELETE FROM virtual_users WHERE email='$e';" || true
    json_ok "{\"email\":\"$email\",\"action\":\"$COMMAND\"}"
    ;;
  mailbox.unsuspend)
    email="$(field email)"
    json_ok "{\"email\":\"$email\",\"action\":\"mailbox.unsuspend\",\"note\":\"re-run mailbox.password to restore MySQL row\"}"
    ;;
  mailbox.quota)
    email="$(field email)"
    json_ok "{\"email\":\"$email\",\"action\":\"mailbox.quota\"}"
    ;;
  alias.sync|forwarder.sync|vacation.sync|dkim.sync)
    json_ok "{\"action\":\"$COMMAND\"}"
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
    json_ok "{\"scheme\":\"$scheme\",\"vmailBase\":\"$VMAIL_BASE\",\"mysqlDatabase\":\"${MAIL_MYSQL_DATABASE:-mailserver}\"}"
    ;;
  *)
    json_err "Unknown command: $COMMAND"
    ;;
esac
