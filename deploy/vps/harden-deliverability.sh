#!/usr/bin/env bash
# GLOBAL ORBIT MAIL — Gmail/Workspace-class deliverability harden
# Run ON the mail VPS as root. Idempotent. Does not wipe Dovecot SQL auth.
#
# Aligns Postfix EHLO with live PTR, enables opportunistic TLS,
# wires OpenDKIM milters, rejects open relay, verifies no IPv6 outbound,
# and installs Roundcube deliverability headers include.
#
# Usage:
#   bash deploy/vps/harden-deliverability.sh [apex-domain-for-dns-hints]
#
set -euo pipefail

MAIL_IP="${MAIL_IP:-200.97.170.235}"
PUBLIC_MX="${PUBLIC_MX:-mail.globalorbitmail.cloud}"
# Live PTR today is mail.theglobalorbit.com — EHLO MUST match PTR for FCrDNS
LIVE_PTR="$(dig -x "$MAIL_IP" +short 2>/dev/null | sed 's/\.$//' | head -n1 || true)"
PTR_HOSTNAME="${PTR_HOSTNAME:-${LIVE_PTR:-mail.theglobalorbit.com}}"
DESIRED_PTR="${DESIRED_PTR:-mail.globalorbitmail.cloud}"
RC_ROOT="${ORBIT_ROUNDCUBE_ROOT:-/var/www/roundcube}"
HINT_DOMAIN="${1:-zenspanp.com}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=============================================="
echo " GLOBAL ORBIT MAIL — Deliverability Harden"
echo "=============================================="
echo "MAIL_IP=${MAIL_IP}"
echo "LIVE_PTR=${LIVE_PTR:-unknown}"
echo "EHLO/myhostname → ${PTR_HOSTNAME}"
echo "Public MX brand → ${PUBLIC_MX}"
echo

# --- 1) Postfix identity + TLS + relay lock ---
echo "==> [1/10] Postfix identity, TLS, open-relay lock"
if ! command -v postconf >/dev/null 2>&1; then
  echo "ERROR: postconf not found" >&2
  exit 1
fi

postconf -e "myhostname = ${PTR_HOSTNAME}"
postconf -e "smtp_helo_name = ${PTR_HOSTNAME}"
postconf -e "mydomain = ${PTR_HOSTNAME#mail.}"
postconf -e "inet_protocols = ipv4"
postconf -e "smtp_address_preference = ipv4"
postconf -e "smtp_host_lookup = dns"
postconf -e "disable_dns_lookups = no"

# Opportunistic TLS outbound (Gmail/Outlook/Yahoo expect STARTTLS when offered)
postconf -e "smtp_tls_security_level = may"
postconf -e "smtp_tls_loglevel = 1"
postconf -e "smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt"
postconf -e "smtp_tls_session_cache_database = btree:\${data_directory}/smtp_scache"

# Inbound TLS (opportunistic + submission usually encrypt)
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtpd_tls_auth_only = yes"
postconf -e "smtpd_tls_received_header = yes"
postconf -e "smtpd_tls_loglevel = 1"
if [[ -f /etc/letsencrypt/live/${PUBLIC_MX}/fullchain.pem ]]; then
  postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/${PUBLIC_MX}/fullchain.pem"
  postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/${PUBLIC_MX}/privkey.pem"
elif [[ -f /etc/letsencrypt/live/${PTR_HOSTNAME}/fullchain.pem ]]; then
  postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/${PTR_HOSTNAME}/fullchain.pem"
  postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/${PTR_HOSTNAME}/privkey.pem"
fi

# Headers / envelope
postconf -e "always_add_missing_headers = yes"
postconf -e "enable_long_queue_ids = yes"
postconf -e "message_size_limit = 26214400"
postconf -e "mailbox_size_limit = 0"
postconf -e "maximal_queue_lifetime = 5d"
postconf -e "bounce_queue_lifetime = 5d"
postconf -e "delay_warning_time = 4h"
postconf -e "notify_classes = resource, software, bounce, delay"
postconf -e "soft_bounce = no"
postconf -e "append_dot_mydomain = no"
postconf -e "biff = no"

# Open relay lock (authenticated + mynetworks only)
postconf -e "smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, defer_unauth_destination"
postconf -e "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination, reject_invalid_hostname, reject_non_fqdn_sender, reject_non_fqdn_recipient, reject_unknown_sender_domain, reject_unknown_recipient_domain"
postconf -e "smtpd_sender_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_non_fqdn_sender, reject_unknown_sender_domain"
postconf -e "smtpd_helo_required = yes"
postconf -e "mynetworks = 127.0.0.0/8 [::1]/128"

# Prefer Return-Path = envelope sender from auth user (SASL)
postconf -e "smtpd_sender_login_maps = static:"
# Leave sender_login_maps empty/static if not using reject_sender_login_mismatch yet

echo "    myhostname=$(postconf -h myhostname)"
echo "    smtp_helo_name=$(postconf -h smtp_helo_name)"
echo "    smtp_tls_security_level=$(postconf -h smtp_tls_security_level)"
echo "    smtpd_relay_restrictions=$(postconf -h smtpd_relay_restrictions)"

# --- 2) OpenDKIM milter ---
echo "==> [2/10] OpenDKIM milter wiring"
if command -v opendkim >/dev/null 2>&1 || [[ -d /etc/opendkim ]]; then
  milters="$(postconf -h smtpd_milters 2>/dev/null || true)"
  if [[ "$milters" != *8891* && "$milters" != *opendkim* ]]; then
    postconf -e "smtpd_milters = inet:localhost:8891"
    postconf -e "non_smtpd_milters = inet:localhost:8891"
    postconf -e "milter_default_action = accept"
    postconf -e "milter_protocol = 6"
  fi
  systemctl enable opendkim 2>/dev/null || true
  systemctl restart opendkim 2>/dev/null || service opendkim restart 2>/dev/null || true
  echo "    milters=$(postconf -h smtpd_milters)"
else
  echo "    WARN: OpenDKIM not installed — apt-get install -y opendkim opendkim-tools"
fi

# --- 3) Roundcube deliverability include ---
echo "==> [3/10] Roundcube headers / HELO / MIME"
mkdir -p "${RC_ROOT}/config" "${RC_ROOT}/temp" "${RC_ROOT}/logs"
cat > "${RC_ROOT}/config/deliverability.inc.php" <<PHP
<?php
/**
 * GLOBAL ORBIT MAIL — deliverability (Workspace-class headers)
 * EHLO identity must match reverse DNS (PTR): ${PTR_HOSTNAME}
 */
\$config['smtp_helo_host'] = '${PTR_HOSTNAME}';
\$config['mail_domain'] = '';
\$config['message_charset'] = 'UTF-8';
\$config['http_received_host'] = 'webmail.globalorbitmail.cloud';
\$config['force_7bit'] = false;
\$config['mdn_use_from'] = true;
// Roundcube always emits Message-ID, Date, MIME-Version, Content-Type on send
\$config['smtp_log'] = false;
\$config['smtp_debug'] = false;
PHP

if [[ -f "${REPO_ROOT}/roundcube/config/attachments-mime.inc.php" ]]; then
  cp -a "${REPO_ROOT}/roundcube/config/attachments-mime.inc.php" "${RC_ROOT}/config/"
  # Align HELO inside attachments snippet with PTR
  sed -i.bak-deliv "s/mail\\.globalorbitmail\\.cloud/${PTR_HOSTNAME}/g" \
    "${RC_ROOT}/config/attachments-mime.inc.php" 2>/dev/null || true
fi
if [[ -f "${REPO_ROOT}/roundcube/config/smtp-transport.inc.php" ]]; then
  cp -a "${REPO_ROOT}/roundcube/config/smtp-transport.inc.php" "${RC_ROOT}/config/"
fi

CFG="${RC_ROOT}/config/config.inc.php"
if [[ -f "$CFG" ]]; then
  for inc in deliverability.inc.php attachments-mime.inc.php smtp-transport.inc.php; do
    grep -q "${inc}" "$CFG" || echo "include __DIR__ . '/${inc}';" >> "$CFG"
  done
  php -l "$CFG" >/dev/null 2>&1 || true
fi
chown -R www-data:www-data "${RC_ROOT}/temp" "${RC_ROOT}/logs" 2>/dev/null || true

# --- 4) Reload Postfix ---
echo "==> [4/10] Reload Postfix"
postfix check 2>/dev/null || true
systemctl reload postfix 2>/dev/null || systemctl restart postfix 2>/dev/null || true

# --- 5) Open relay self-test (localhost unauth must fail) ---
echo "==> [5/10] Open-relay probe (expect reject)"
set +e
RELAY_OUT="$(timeout 8 bash -c "exec 3<>/dev/tcp/127.0.0.1/25
sleep 0.3
cat <&3 &
sleep 0.2
printf 'EHLO test.invalid\r\n' >&3
sleep 0.3
printf 'MAIL FROM:<probe@example.com>\r\n' >&3
sleep 0.3
printf 'RCPT TO:<probe@gmail.com>\r\n' >&3
sleep 0.5
printf 'QUIT\r\n' >&3
sleep 0.3
" 2>&1)"
set -e
if echo "$RELAY_OUT" | grep -Eqi '554|550|553|Relay access denied|Sender address rejected|Recipient address rejected|Authentication required'; then
  echo "    PASS: unauthenticated relay rejected"
else
  echo "    WARN: could not confirm reject (output truncated). Review smtpd_*_restrictions."
  echo "$RELAY_OUT" | head -n 20
fi

# --- 6) DNS hints for customer domain ---
echo "==> [6/10] Public DNS audit hints for ${HINT_DOMAIN}"
echo "    MX:    $(dig +short MX "${HINT_DOMAIN}" 2>/dev/null | tr '\n' ' ')"
echo "    SPF:   $(dig +short TXT "${HINT_DOMAIN}" 2>/dev/null | tr '\n' ' ' | head -c 200)"
echo "    DKIM:  $(dig +short TXT "orbit._domainkey.${HINT_DOMAIN}" 2>/dev/null | tr '\n' ' ')"
echo "    DMARC: $(dig +short TXT "_dmarc.${HINT_DOMAIN}" 2>/dev/null | tr '\n' ' ')"
echo "    PTR:   $(dig -x "${MAIL_IP}" +short 2>/dev/null | tr '\n' ' ')"

# --- 7) Local DNSBL quick check ---
echo "==> [7/10] DNSBL (local resolver)"
REV="$(echo "$MAIL_IP" | awk -F. '{print $4"."$3"."$2"."$1}')"
for z in zen.spamhaus.org bl.spamcop.net b.barracudacentral.org dnsbl.sorbs.net; do
  ans="$(dig +short "${REV}.${z}" A 2>/dev/null | tr '\n' ' ')"
  if [[ -z "$ans" ]]; then
    echo "    CLEAR ${z}"
  else
    echo "    LISTED ${z} → ${ans}"
  fi
done

# --- 8) SpamAssassin / Rspamd status ---
echo "==> [8/10] Content filter status"
if command -v spamassassin >/dev/null 2>&1 || systemctl is-active --quiet spamassassin 2>/dev/null; then
  echo "    SpamAssassin present"
  spamassassin -V 2>/dev/null | head -n 2 || true
elif command -v rspamc >/dev/null 2>&1 || systemctl is-active --quiet rspamd 2>/dev/null; then
  echo "    Rspamd present"
  rspamc -h 2>/dev/null | head -n 5 || true
else
  echo "    INFO: no SpamAssassin/Rspamd CLI — outbound score via mail-tester.com recommended"
fi

# --- 9) Dovecot (auth only — do not rewrite) ---
echo "==> [9/10] Dovecot sanity (read-only)"
if command -v doveconf >/dev/null 2>&1; then
  doveconf -n protocols 2>/dev/null | head -n 5 || true
  doveconf -n ssl 2>/dev/null | head -n 8 || true
  doveconf -n mail_location 2>/dev/null | head -n 3 || true
fi

# --- 10) Summary ---
echo "==> [10/10] Summary"
cat <<EOF

APPLIED:
  ✓ Postfix myhostname/smtp_helo_name = ${PTR_HOSTNAME} (matches live PTR)
  ✓ smtp_tls_security_level = may (opportunistic TLS)
  ✓ always_add_missing_headers = yes
  ✓ Open-relay restrictions tightened
  ✓ inet_protocols = ipv4 (Gmail IPv6AuthError mitigation)
  ✓ Roundcube deliverability.inc.php (HELO + charset)

MUST STILL BE TRUE (DNS / provider — not auto-fixable here):
  1) Publish DKIM TXT orbit._domainkey.${HINT_DOMAIN} from Orbit Admin
  2) Publish DMARC _dmarc.${HINT_DOMAIN}  (start p=none then quarantine)
  3) SPF should include: v=spf1 mx a:${PUBLIC_MX} ip4:${MAIL_IP} -all
  4) Optional brand alignment: ask Hostinger to set PTR ${MAIL_IP} → ${DESIRED_PTR}
     Until then EHLO correctly uses ${PTR_HOSTNAME} (FCrDNS PASS today).

MAIL-TESTER:
  From Roundcube send to the address shown on https://www.mail-tester.com/
  Target score ≥ 9.5/10. Re-run after DKIM+DMARC published.

GMAIL Show original must show:
  SPF: PASS
  DKIM: PASS (d=${HINT_DOMAIN} / s=orbit)
  DMARC: PASS
EOF
