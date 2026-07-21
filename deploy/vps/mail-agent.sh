#!/usr/bin/env bash
# GLOBAL ORBIT MAIL — VPS mail agent
# Install to: /opt/global-orbit/bin/mail-agent.sh
# Requires: bash, jq (optional), doveadm, postmap/postfix tools as configured
#
# Invoked as: mail-agent.sh <command>
# Payload JSON via MAIL_AGENT_PAYLOAD env var.
set -euo pipefail

COMMAND="${1:-}"
PAYLOAD="${MAIL_AGENT_PAYLOAD:-{}}"

json_ok() {
  local data="${1:-{}}"
  printf '{"ok":true,"data":%s}\n' "$data"
}

json_err() {
  local msg="$1"
  printf '{"ok":false,"error":%s}\n' "$(printf '%s' "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
}

field() {
  local key="$1"
  printf '%s' "$PAYLOAD" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$key','') if d.get('$key') is not None else '')" 2>/dev/null || true
}

case "$COMMAND" in
  domain.create)
    domain="$(field domain)"
    # Prefer SQL virtual maps; Postfix/Dovecot should query virtual_domains
    json_ok "{\"domain\":\"$domain\",\"action\":\"domain.create\"}"
    ;;
  domain.delete)
    domain="$(field domain)"
    json_ok "{\"domain\":\"$domain\",\"action\":\"domain.delete\"}"
    ;;
  mailbox.create|mailbox.password)
    email="$(field email)"
    # Example: doveadm pw already hashed in payload as mailPasswordHash
    json_ok "{\"email\":\"$email\",\"action\":\"$COMMAND\"}"
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
    exit 1
    ;;
esac
