#!/usr/bin/env bash
# One-shot production repair: SHA512-CRYPT → MySQL mailserver.virtual_users → doveadm auth test
#
# Usage (ON THE MAIL VPS as root):
#   bash deploy/vps/fix-dovecot-auth.sh user@domain.com 'TheRealPassword'
#
# Exits 0 only when: doveadm auth test → passdb: user authenticated
set -euo pipefail

EMAIL="${1:-}"
PASSWORD="${2:-}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Usage: $0 user@domain.com 'password'" >&2
  exit 2
fi

EMAIL="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]')"
DOMAIN="${EMAIL#*@}"
LOCAL="${EMAIL%@*}"
VMAIL_BASE="${VMAIL_BASE:-/var/mail/vhosts}"
VMAIL_UID="${VMAIL_UID:-5000}"
VMAIL_GID="${VMAIL_GID:-5000}"
HOME_DIR="${VMAIL_BASE}/${DOMAIN}/${LOCAL}"
MAIL_MYSQL_DATABASE="${MAIL_MYSQL_DATABASE:-mailserver}"

echo "==> Dovecot MySQL passdb target: database=${MAIL_MYSQL_DATABASE} table=virtual_users"
echo "    query: SELECT email,password FROM virtual_users WHERE email='%u'"
echo "    scheme: SHA512-CRYPT"

if [[ -r /etc/dovecot/dovecot-sql.conf.ext ]]; then
  echo "---- /etc/dovecot/dovecot-sql.conf.ext ----"
  grep -E '^(driver|connect|default_pass_scheme|password_query|user_query)' /etc/dovecot/dovecot-sql.conf.ext || true
fi

if ! command -v doveadm >/dev/null 2>&1; then
  echo "ERROR: doveadm not found" >&2
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "ERROR: mysql client not found" >&2
  exit 1
fi

load_mysql_env() {
  if [[ -n "${MAIL_MYSQL_HOST:-}" && -n "${MAIL_MYSQL_USER:-}" ]]; then
    return 0
  fi
  if [[ -n "${MAIL_MYSQL_URL:-}" ]]; then
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
      MAIL_MYSQL_HOST="$(printf '%s' "$connect" | sed -n 's/.*host=\([^ ]*\).*/\1/p')"
      MAIL_MYSQL_PORT="$(printf '%s' "$connect" | sed -n 's/.*port=\([^ ]*\).*/\1/p')"
      MAIL_MYSQL_USER="$(printf '%s' "$connect" | sed -n 's/.*user=\([^ ]*\).*/\1/p')"
      MAIL_MYSQL_PASSWORD="$(printf '%s' "$connect" | sed -n 's/.*password=\([^ ]*\).*/\1/p')"
      MAIL_MYSQL_DATABASE="$(printf '%s' "$connect" | sed -n 's/.*dbname=\([^ ]*\).*/\1/p')"
      if [[ -z "$MAIL_MYSQL_DATABASE" ]]; then
        MAIL_MYSQL_DATABASE="$(printf '%s' "$connect" | sed -n 's/.*database=\([^ ]*\).*/\1/p')"
      fi
      export MAIL_MYSQL_HOST MAIL_MYSQL_USER MAIL_MYSQL_PASSWORD
      export MAIL_MYSQL_PORT="${MAIL_MYSQL_PORT:-3306}"
      export MAIL_MYSQL_DATABASE="${MAIL_MYSQL_DATABASE:-mailserver}"
    fi
  fi
}

load_mysql_env
if [[ -z "${MAIL_MYSQL_USER:-}" ]]; then
  echo "ERROR: Set MAIL_MYSQL_HOST/USER/PASSWORD/DATABASE (or MAIL_MYSQL_URL), or configure dovecot-sql.conf.ext" >&2
  exit 1
fi

echo "==> Generating SHA512-CRYPT with doveadm pw"
HASH="$(doveadm pw -s SHA512-CRYPT -p "$PASSWORD" | tr -d '\r\n')"
HASH="${HASH#\{SHA512-CRYPT\}}"
echo "    hash=${HASH:0:24}…"

echo "==> Ensuring Maildir $HOME_DIR"
mkdir -p "$HOME_DIR"/{cur,new,tmp} \
  "$HOME_DIR"/.Drafts/{cur,new,tmp} \
  "$HOME_DIR"/.Sent/{cur,new,tmp} \
  "$HOME_DIR"/.Junk/{cur,new,tmp} \
  "$HOME_DIR"/.Trash/{cur,new,tmp}
if id -u vmail >/dev/null 2>&1; then
  chown -R vmail:vmail "${VMAIL_BASE}/${DOMAIN}" || true
else
  chown -R "${VMAIL_UID}:${VMAIL_GID}" "${VMAIL_BASE}/${DOMAIN}" || true
fi

ESC_EMAIL="${EMAIL//\'/\'\'}"
ESC_DOMAIN="${DOMAIN//\'/\'\'}"
ESC_HASH="${HASH//\'/\'\'}"

run_mysql() {
  MYSQL_PWD="${MAIL_MYSQL_PASSWORD:-}" mysql \
    -h "${MAIL_MYSQL_HOST:-127.0.0.1}" \
    -P "${MAIL_MYSQL_PORT:-3306}" \
    -u "${MAIL_MYSQL_USER}" \
    "${MAIL_MYSQL_DATABASE:-mailserver}" \
    -e "$1"
}

echo "==> Writing MySQL ${MAIL_MYSQL_DATABASE}.virtual_users"
run_mysql "
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
  KEY domain_id (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"

run_mysql "INSERT INTO virtual_domains (name) VALUES ('$ESC_DOMAIN') ON DUPLICATE KEY UPDATE name=VALUES(name);"
run_mysql "
INSERT INTO virtual_users (email, password, domain_id)
SELECT '$ESC_EMAIL', '$ESC_HASH', id FROM virtual_domains WHERE name='$ESC_DOMAIN' LIMIT 1
ON DUPLICATE KEY UPDATE password=VALUES(password), domain_id=VALUES(domain_id);
"

echo "==> Verifying MySQL row"
run_mysql "SELECT email, LEFT(password,28) AS password_prefix FROM virtual_users WHERE email='$ESC_EMAIL';"

echo "==> doveadm auth test $EMAIL"
set +e
AUTH_OUT="$(doveadm auth test "$EMAIL" "$PASSWORD" 2>&1)"
AUTH_RC=$?
set -e
echo "$AUTH_OUT"

if echo "$AUTH_OUT" | grep -qi "passdb: user authenticated"; then
  echo
  echo "SUCCESS: passdb: user authenticated"
  echo "Next: Roundcube login → send → receive"
  exit 0
fi

echo
echo "FAILED: doveadm auth test did not authenticate (rc=$AUTH_RC)"
echo "Next checks:"
echo "  1) password_query must SELECT email,password FROM virtual_users WHERE email='%u'"
echo "  2) driver=mysql and connect= must point at database mailserver"
echo "  3) default_pass_scheme = SHA512-CRYPT"
echo "  4) systemctl reload dovecot"
echo "  5) doveadm auth test -D $EMAIL 'password'"
exit 1
