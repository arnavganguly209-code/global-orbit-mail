#!/usr/bin/env bash
# One-shot production repair: hash with live doveadm, write virtual_users, prove auth.
#
# Usage (ON THE MAIL VPS as root):
#   bash deploy/vps/fix-dovecot-auth.sh recaption@zenspanp.com 'TheRealPassword'
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

echo "==> Detecting Dovecot password scheme"
SCHEME=""
if command -v doveconf >/dev/null 2>&1; then
  SCHEME="$(doveconf -h auth_default_scheme 2>/dev/null || true)"
  [[ -z "$SCHEME" ]] && SCHEME="$(doveconf -h default_pass_scheme 2>/dev/null || true)"
fi
if [[ -z "$SCHEME" && -r /etc/dovecot/dovecot-sql.conf.ext ]]; then
  SCHEME="$(awk -F= '/^default_pass_scheme/{gsub(/[[:space:]]/,"",$2); print $2; exit}' /etc/dovecot/dovecot-sql.conf.ext || true)"
fi
SCHEME="${SCHEME:-SHA512-CRYPT}"
echo "    scheme=$SCHEME"

echo "==> Dumping live passdb/userdb config (summary)"
if command -v doveconf >/dev/null 2>&1; then
  doveconf -n 2>/dev/null | grep -E 'passdb|userdb|driver|args|default_pass_scheme|auth_default_scheme|mail_location' || true
fi
if [[ -r /etc/dovecot/dovecot-sql.conf.ext ]]; then
  echo "---- /etc/dovecot/dovecot-sql.conf.ext ----"
  grep -E '^(driver|connect|default_pass_scheme|password_query|user_query)' /etc/dovecot/dovecot-sql.conf.ext || true
fi

if ! command -v doveadm >/dev/null 2>&1; then
  echo "ERROR: doveadm not found" >&2
  exit 1
fi

echo "==> Generating hash with doveadm pw -s $SCHEME"
HASH="$(doveadm pw -s "$SCHEME" -p "$PASSWORD" | tr -d '\r\n')"
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

resolve_psql() {
  if [[ -n "${MAIL_SQL_DSN:-}" ]]; then echo "$MAIL_SQL_DSN"; return; fi
  if [[ -n "${DATABASE_URL:-}" ]]; then echo "$DATABASE_URL"; return; fi
  if [[ -r /etc/dovecot/dovecot-sql.conf.ext ]]; then
    awk -F= '/^connect/{sub(/^[^=]+=/,""); gsub(/^[[:space:]]+|[[:space:]]+$/,""); print; exit}' /etc/dovecot/dovecot-sql.conf.ext
  fi
}

DSN="$(resolve_psql)"
if [[ -z "$DSN" ]]; then
  echo "ERROR: Set MAIL_SQL_DSN or DATABASE_URL, or configure dovecot-sql.conf.ext connect=" >&2
  exit 1
fi
echo "==> Writing virtual_users via psql"

ESC_EMAIL="${EMAIL//\'/\'\'}"
ESC_DOMAIN="${DOMAIN//\'/\'\'}"
ESC_HASH="${HASH//\'/\'\'}"
ESC_HOME="${HOME_DIR//\'/\'\'}"

run_psql() {
  local sql="$1"
  if [[ "$DSN" == postgres*://* || "$DSN" == postgresql*://* ]]; then
    psql "$DSN" -v ON_ERROR_STOP=1 -c "$sql"
  else
    # shellcheck disable=SC2086
    psql $DSN -v ON_ERROR_STOP=1 -c "$sql"
  fi
}

run_psql "
CREATE TABLE IF NOT EXISTS virtual_domains (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS virtual_users (
  id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
  domain TEXT NOT NULL, quota_bytes BIGINT NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT true,
  home TEXT, uid INTEGER, gid INTEGER
);
ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS home TEXT;
ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS uid INTEGER;
ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS gid INTEGER;
"

run_psql "INSERT INTO virtual_domains (name, active) VALUES ('$ESC_DOMAIN', true)
  ON CONFLICT (name) DO UPDATE SET active = true;"

run_psql "
INSERT INTO virtual_users (email, password, domain, quota_bytes, active, home, uid, gid)
VALUES ('$ESC_EMAIL', '$ESC_HASH', '$ESC_DOMAIN', 2147483648, true, '$ESC_HOME', $VMAIL_UID, $VMAIL_GID)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password, active = true, home = EXCLUDED.home,
  uid = EXCLUDED.uid, gid = EXCLUDED.gid;
"

echo "==> Verifying SQL row"
run_psql "SELECT email, left(password,28) AS password_prefix, home, active FROM virtual_users WHERE email='$ESC_EMAIL';"

echo "==> doveadm user lookup"
doveadm user "$EMAIL" || true

echo "==> doveadm auth test $EMAIL"
set +e
AUTH_OUT="$(doveadm auth test "$EMAIL" "$PASSWORD" 2>&1)"
AUTH_RC=$?
set -e
echo "$AUTH_OUT"

if echo "$AUTH_OUT" | grep -qi "passdb: user authenticated"; then
  echo
  echo "SUCCESS: passdb: user authenticated"
  exit 0
fi

echo
echo "FAILED: doveadm auth test did not authenticate (rc=$AUTH_RC)"
echo "Next checks:"
echo "  1) password_query must SELECT from virtual_users WHERE email='%u'"
echo "  2) dovecot-sql.conf.ext connect= must point at THIS database"
echo "  3) systemctl reload dovecot"
echo "  4) doveadm auth test -D $EMAIL 'password'   # debug"
exit 1
