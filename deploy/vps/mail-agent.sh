#!/usr/bin/env bash
# GLOBAL ORBIT MAIL — VPS mail agent
# Install to: /opt/global-orbit/bin/mail-agent.sh
#
# Invoked as: mail-agent.sh <command>
# Payload JSON via MAIL_AGENT_PAYLOAD env var.
#
# Supports both shapes:
#   {"command":"mailbox.create","payload":{"email":"...","mailPasswordHash":"..."}}
#   {"email":"...","mailPasswordHash":"..."}
#
# Creates Maildir under VMAIL_BASE (default /var/mail/vhosts/%d/%n).
# Dovecot passdb MUST query PostgreSQL virtual_users (see deploy/vps/dovecot-sql.conf.ext).
set -euo pipefail

COMMAND="${1:-}"
PAYLOAD="${MAIL_AGENT_PAYLOAD:-{}}"

VMAIL_BASE="${VMAIL_BASE:-/var/mail/vhosts}"
VMAIL_UID="${VMAIL_UID:-5000}"
VMAIL_GID="${VMAIL_GID:-5000}"

json_ok() {
  local data="${1:-{}}"
  printf '{"ok":true,"data":%s}\n' "$data"
}

json_err() {
  local msg="$1"
  printf '{"ok":false,"error":%s}\n' "$(printf '%s' "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
  exit 1
}

# Read key from top-level OR nested payload
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
      if id -u "vmail" >/dev/null 2>&1; then
        chown -R "vmail:vmail" "${VMAIL_BASE}/${domain}" 2>/dev/null || true
      else
        chown -R "${VMAIL_UID}:${VMAIL_GID}" "${VMAIL_BASE}/${domain}" 2>/dev/null || true
      fi
    fi
    json_ok "{\"domain\":\"$domain\",\"action\":\"domain.create\",\"maildirBase\":\"${VMAIL_BASE}/${domain}\"}"
    ;;
  domain.delete)
    domain="$(field domain)"
    json_ok "{\"domain\":\"$domain\",\"action\":\"domain.delete\"}"
    ;;
  mailbox.create|mailbox.password)
    email="$(field email)"
    email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
    hash="$(field mailPasswordHash)"
    if [[ -z "$email" || "$email" != *"@"* ]]; then
      json_err "mailbox.create requires email"
    fi
    if [[ -z "$hash" ]]; then
      json_err "mailbox.create requires mailPasswordHash ({BLF-CRYPT}...)"
    fi
    home="$(ensure_maildir "$email")"
    # Password itself is written by Orbit into PostgreSQL virtual_users (Dovecot passdb).
    # Agent ensures Maildir exists so IMAP login can open the inbox.
    json_ok "{\"email\":\"$email\",\"action\":\"$COMMAND\",\"home\":\"$home\",\"passdb\":\"virtual_users\",\"scheme\":\"BLF-CRYPT\"}"
    ;;
  mailbox.delete|mailbox.suspend|mailbox.unsuspend)
    email="$(field email)"
    json_ok "{\"email\":\"$email\",\"action\":\"$COMMAND\"}"
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
    cpu=0
    ram=0
    disk=0
    if [[ -r /proc/loadavg ]]; then
      cpu="$(awk '{printf "%.1f", $1}' /proc/loadavg)"
    fi
    if [[ -r /proc/meminfo ]]; then
      ram="$(awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{if(t>0) printf "%.1f", (t-a)*100/t}' /proc/meminfo)"
    fi
    disk="$(df -P / 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}')"
    json_ok "{\"cpuPercent\":$cpu,\"ramPercent\":${ram:-0},\"diskPercent\":${disk:-0}}"
    ;;
  *)
    json_err "Unknown command: $COMMAND"
    ;;
esac
