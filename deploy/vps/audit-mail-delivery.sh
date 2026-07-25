#!/usr/bin/env bash
# Read-only production mail delivery audit (Google/Zoho-class checklist).
# Usage: bash deploy/vps/audit-mail-delivery.sh [domain]
set -euo pipefail

DOMAIN="${1:-zenspanp.com}"
MAIL_IP="${MAIL_IP:-200.97.170.235}"
PUBLIC_HOST="${PUBLIC_HOST:-mail.globalorbitmail.cloud}"
PTR_HOST="${PTR_HOST:-mail.theglobalorbit.com}"
RC_ROOT="${RC_ROOT:-/var/www/roundcube}"

pass=0; fail=0; warn=0
ok(){ echo "PASS  $*"; pass=$((pass+1)); }
bad(){ echo "FAIL  $*"; fail=$((fail+1)); }
wrn(){ echo "WARN  $*"; warn=$((warn+1)); }

echo "=== Orbit mail delivery audit $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "domain=$DOMAIN ip=$MAIL_IP"

# TLS / ports
for spec in "25/tcp" "465/tcp" "587/tcp" "993/tcp"; do
  if ss -lnt | grep -qE ":${spec%%/*} "; then ok "listen ${spec}"; else bad "listen ${spec}"; fi
done

# Postfix
if command -v postconf >/dev/null; then
  msz=$(postconf -h message_size_limit)
  mh=$(postconf -h myhostname)
  helo=$(postconf -h smtp_helo_name 2>/dev/null || echo "$mh")
  [[ "$msz" -ge 10485760 ]] && ok "message_size_limit=$msz" || bad "message_size_limit=$msz (<10M)"
  ptr=$(dig -x "$MAIL_IP" +short | sed 's/\.$//' | head -n1)
  echo "    ptr=$ptr myhostname=$mh smtp_helo_name=$helo"
  if [[ -n "$ptr" && "$mh" == "$ptr" ]]; then ok "HELO/PTR aligned ($mh)"; else bad "HELO/PTR mismatch myhostname=$mh ptr=$ptr"; fi
else
  bad "postconf missing"
fi

# PHP / nginx / Roundcube
php -r 'echo "upload=".ini_get("upload_max_filesize")." post=".ini_get("post_max_size")."\n";' 2>/dev/null || wrn "php cli missing"
if [[ -f /etc/nginx/conf.d/orbit-mail-uploads.conf ]] || grep -Rqs "client_max_body_size" /etc/nginx 2>/dev/null; then
  ok "nginx client_max_body_size configured"
else
  wrn "nginx client_max_body_size not found"
fi
[[ -d "${RC_ROOT}/temp" && -w "${RC_ROOT}/temp" ]] && ok "Roundcube temp writable" || bad "Roundcube temp not writable"
grep -qs "attachments-mime.inc.php\|max_message_size" "${RC_ROOT}/config/"*.php 2>/dev/null && ok "Roundcube max_message_size include" || wrn "Roundcube attachment include missing"
grep -qs "smtp-transport.inc.php\|smtp_host" "${RC_ROOT}/config/"*.php 2>/dev/null && ok "Roundcube smtp_host present" || bad "Roundcube smtp_host missing"

# Queue
if command -v mailq >/dev/null; then
  q=$(mailq 2>/dev/null | tail -n 1 || true)
  echo "    mailq: $q"
  if mailq 2>/dev/null | grep -qi 'Mail queue is empty'; then ok "mail queue empty"; else wrn "mail queue not empty — inspect mailq"; fi
fi

# DNS
mx=$(dig +short MX "$DOMAIN" | head -n1)
echo "    MX: $mx"
echo "$mx" | grep -qi "$PUBLIC_HOST" && ok "MX → $PUBLIC_HOST" || bad "MX does not point to $PUBLIC_HOST"
spf=$(dig +short TXT "$DOMAIN" | tr -d '"' | grep -i 'v=spf1' | head -n1 || true)
[[ -n "$spf" ]] && ok "SPF: $spf" || bad "SPF missing"
dmarc=$(dig +short TXT "_dmarc.$DOMAIN" | tr -d '"' | head -n1 || true)
[[ -n "$dmarc" ]] && ok "DMARC: $dmarc" || wrn "DMARC missing for $DOMAIN"
dkim_found=0
for sel in orbit dkim default mail; do
  v=$(dig +short TXT "${sel}._domainkey.$DOMAIN" | tr -d '"' | head -n1 || true)
  if [[ -n "$v" ]]; then ok "DKIM ${sel}._domainkey"; dkim_found=1; break; fi
done
[[ "$dkim_found" -eq 1 ]] || bad "DKIM TXT missing for $DOMAIN (publish orbit._domainkey)"

# OpenDKIM
if pgrep -x opendkim >/dev/null 2>&1 || systemctl is-active --quiet opendkim 2>/dev/null; then
  ok "OpenDKIM process"
else
  bad "OpenDKIM not running — outbound unsigned"
fi

# Dovecot quota
if command -v doveadm >/dev/null; then
  doveconf -n plugin 2>/dev/null | grep -qi quota && ok "Dovecot quota plugin" || wrn "Dovecot quota plugin not evident"
fi

echo
echo "SUMMARY pass=$pass warn=$warn fail=$fail"
[[ "$fail" -eq 0 ]] || exit 1
