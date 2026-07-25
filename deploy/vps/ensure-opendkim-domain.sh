#!/usr/bin/env bash
# Publish / verify DKIM DNS guidance for a hosted domain (OpenDKIM + Orbit selector).
# Does not change Postfix auth. Requires OpenDKIM keys on the VPS.
#
# Usage:
#   bash deploy/vps/ensure-opendkim-domain.sh zenspanp.com orbit
#
set -euo pipefail

DOMAIN="${1:?domain required}"
SELECTOR="${2:-orbit}"
OPENDKIM_DIR="${OPENDKIM_DIR:-/etc/opendkim}"
KEYS_DIR="${KEYS_DIR:-${OPENDKIM_DIR}/keys}"

echo "==> Domain ${DOMAIN} selector ${SELECTOR}"

if ! command -v opendkim-genkey >/dev/null 2>&1 && [[ ! -d "$OPENDKIM_DIR" ]]; then
  echo "OpenDKIM not installed. On Ubuntu:"
  echo "  apt-get install -y opendkim opendkim-tools"
  echo "  # then wire smtpd_milters in Postfix (see harden-mail-delivery.sh notes)"
  exit 1
fi

mkdir -p "${KEYS_DIR}/${DOMAIN}"
if [[ ! -f "${KEYS_DIR}/${DOMAIN}/${SELECTOR}.private" ]]; then
  opendkim-genkey -b 2048 -s "$SELECTOR" -d "$DOMAIN" -D "${KEYS_DIR}/${DOMAIN}"
  echo "Generated new keypair in ${KEYS_DIR}/${DOMAIN}"
fi

# KeyTable / SigningTable snippets (append-safe)
KT="${OPENDKIM_DIR}/KeyTable"
ST="${OPENDKIM_DIR}/SigningTable"
TD="${OPENDKIM_DIR}/TrustedHosts"
touch "$KT" "$ST" "$TD"
grep -q "${SELECTOR}._domainkey.${DOMAIN}" "$KT" 2>/dev/null || \
  echo "${SELECTOR}._domainkey.${DOMAIN} ${DOMAIN}:${SELECTOR}:${KEYS_DIR}/${DOMAIN}/${SELECTOR}.private" >> "$KT"
grep -q "${DOMAIN}" "$ST" 2>/dev/null || \
  echo "*@${DOMAIN} ${SELECTOR}._domainkey.${DOMAIN}" >> "$ST"
grep -q "127.0.0.1" "$TD" 2>/dev/null || echo "127.0.0.1" >> "$TD"
grep -q "${DOMAIN}" "$TD" 2>/dev/null || echo "$DOMAIN" >> "$TD"

chown -R opendkim:opendkim "${KEYS_DIR}/${DOMAIN}" 2>/dev/null || true
chmod 600 "${KEYS_DIR}/${DOMAIN}/${SELECTOR}.private" 2>/dev/null || true

systemctl restart opendkim 2>/dev/null || service opendkim restart 2>/dev/null || true

echo
echo "PUBLISH THIS DNS TXT at host ${SELECTOR}._domainkey :"
if [[ -f "${KEYS_DIR}/${DOMAIN}/${SELECTOR}.txt" ]]; then
  cat "${KEYS_DIR}/${DOMAIN}/${SELECTOR}.txt"
else
  echo "(missing ${SELECTOR}.txt — check opendkim-genkey output)"
fi
echo
echo "Also ensure SPF includes: ip4:200.97.170.235"
echo "DMARC: v=DMARC1; p=none; rua=mailto:postmaster@${DOMAIN}"
echo "Postfix milters should include inet:localhost:8891 (typical OpenDKIM)"
