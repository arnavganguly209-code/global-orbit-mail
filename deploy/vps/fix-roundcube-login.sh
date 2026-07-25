#!/usr/bin/env bash
# ONE-SHOT production repair for Roundcube / Dovecot MariaDB auth.
# Run ON the mail VPS as root. Does not need the Next.js app redeploy.
#
# Usage:
#   bash deploy/vps/fix-roundcube-login.sh 'user@domain.com' 'PlainPassword'
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
HOME_DIR="${VMAIL_BASE}/${DOMAIN}/${LOCAL}"

echo "==> [1/6] Dovecot SQL config"
CONF="/etc/dovecot/dovecot-sql.conf.ext"
if [[ ! -r "$CONF" ]]; then
  echo "ERROR: missing $CONF" >&2
  exit 1
fi
grep -E '^(driver|connect|default_pass_scheme|password_query)' "$CONF" || true

DRIVER="$(awk -F= '/^driver/{gsub(/[[:space:]]/,"",$2); print $2; exit}' "$CONF")"
SCHEME="$(awk -F= '/^default_pass_scheme/{gsub(/[[:space:]]/,"",$2); print $2; exit}' "$CONF")"
CONNECT="$(awk -F= '/^connect/{sub(/^[^=]+=/,""); gsub(/^[[:space:]]+|[[:space:]]+$/,""); print; exit}' "$CONF")"

echo "    driver=$DRIVER scheme=${SCHEME:-SHA512-CRYPT}"

if [[ "$DRIVER" != "mysql" ]]; then
  echo "WARN: driver is '$DRIVER' (expected mysql for MariaDB mailserver)" >&2
fi

HOST="$(printf '%s' "$CONNECT" | sed -n 's/.*host=\([^ ]*\).*/\1/p')"
PORT="$(printf '%s' "$CONNECT" | sed -n 's/.*port=\([^ ]*\).*/\1/p')"
USER="$(printf '%s' "$CONNECT" | sed -n 's/.*user=\([^ ]*\).*/\1/p')"
PASS="$(printf '%s' "$CONNECT" | sed -n 's/.*password=\([^ ]*\).*/\1/p')"
DB="$(printf '%s' "$CONNECT" | sed -n 's/.*dbname=\([^ ]*\).*/\1/p')"
[[ -z "$DB" ]] && DB="$(printf '%s' "$CONNECT" | sed -n 's/.*database=\([^ ]*\).*/\1/p')"
HOST="${MAIL_MYSQL_HOST:-${HOST:-127.0.0.1}}"
PORT="${MAIL_MYSQL_PORT:-${PORT:-3306}}"
USER="${MAIL_MYSQL_USER:-$USER}"
PASS="${MAIL_MYSQL_PASSWORD:-$PASS}"
DB="${MAIL_MYSQL_DATABASE:-${DB:-mailserver}}"

if [[ -z "$USER" ]]; then
  echo "ERROR: could not resolve MariaDB user from dovecot-sql.conf.ext / MAIL_MYSQL_*" >&2
  exit 1
fi

CLIENT=mysql
command -v mysql >/dev/null 2>&1 || CLIENT=mariadb
command -v "$CLIENT" >/dev/null 2>&1 || { echo "ERROR: mysql/mariadb client missing" >&2; exit 1; }

run_sql() {
  MYSQL_PWD="$PASS" "$CLIENT" -h "$HOST" -P "$PORT" -u "$USER" "$DB" -e "$1"
}

echo "==> [2/6] Generate SHA512-CRYPT with doveadm"
HASH="$(doveadm pw -s SHA512-CRYPT -p "$PASSWORD" | tr -d '\r\n')"
HASH="${HASH#\{SHA512-CRYPT\}}"
echo "    hash=${HASH:0:24}…"
[[ "$HASH" == \$6\$* ]] || { echo "ERROR: hash is not \$6\$" >&2; exit 1; }

echo "==> [3/6] Ensure Maildir $HOME_DIR"
mkdir -p "$HOME_DIR"/{cur,new,tmp} \
  "$HOME_DIR"/.Drafts/{cur,new,tmp} \
  "$HOME_DIR"/.Sent/{cur,new,tmp} \
  "$HOME_DIR"/.Junk/{cur,new,tmp} \
  "$HOME_DIR"/.Trash/{cur,new,tmp}
if id -u vmail >/dev/null 2>&1; then
  chown -R vmail:vmail "${VMAIL_BASE}/${DOMAIN}" || true
fi

ESC_EMAIL="${EMAIL//\'/\'\'}"
ESC_DOMAIN="${DOMAIN//\'/\'\'}"
ESC_HASH="${HASH//\'/\'\'}"

echo "==> [4/6] Upsert MariaDB ${DB}.virtual_domains + virtual_users"
run_sql "INSERT INTO virtual_domains (name) VALUES ('$ESC_DOMAIN') ON DUPLICATE KEY UPDATE name=VALUES(name);"
run_sql "
INSERT INTO virtual_users (email, password, domain_id)
SELECT '$ESC_EMAIL', '$ESC_HASH', id FROM virtual_domains WHERE name='$ESC_DOMAIN' LIMIT 1
ON DUPLICATE KEY UPDATE password=VALUES(password), domain_id=VALUES(domain_id);
"

echo "==> [5/6] SQL verification"
run_sql "SELECT email, LEFT(password,28) AS password_prefix FROM virtual_users WHERE email='$ESC_EMAIL';"

echo "==> [6/6] doveadm auth test"
set +e
OUT="$(doveadm auth test "$EMAIL" "$PASSWORD" 2>&1)"
RC=$?
set -e
echo "$OUT"
if echo "$OUT" | grep -qi "passdb: user authenticated"; then
  echo
  echo "SUCCESS: passdb: user authenticated"
  echo "Next: login Roundcube as $EMAIL"
  exit 0
fi
echo
echo "FAILED (rc=$RC). Check password_query points at virtual_users and reload dovecot."
exit 1
