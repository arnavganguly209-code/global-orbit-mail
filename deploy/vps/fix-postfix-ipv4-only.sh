#!/usr/bin/env bash
# Fix Gmail 550 5.7.1 IPv6AuthError — force Postfix IPv4 until IPv6 has PTR+SPF.
# Does NOT change Roundcube, Dovecot, SMTP AUTH, or Orbit Admin app code.
#
# Usage (on mail VPS as root):
#   bash deploy/vps/fix-postfix-ipv4-only.sh
#
set -euo pipefail

IPV6="${MAIL_SERVER_IPV6:-2a02:4780:63:1d79::1}"
IPV4="${MAIL_SERVER_IPV4:-200.97.170.235}"

echo "==> Audit outbound identity"
echo "    IPv4: $IPV4"
echo "    IPv6: $IPV6"

ptr4="$(dig -x "$IPV4" +short 2>/dev/null | sed 's/\.$//' | head -n1 || true)"
ptr6="$(dig -x "$IPV6" +short 2>/dev/null | sed 's/\.$//' | head -n1 || true)"
echo "    PTR IPv4: ${ptr4:-MISSING}"
echo "    PTR IPv6: ${ptr6:-MISSING}"

echo "==> SPF (must authorize sending IP)"
for d in zenspanp.com globalorbitmail.cloud theglobalorbit.com; do
  spf="$(dig +short TXT "$d" 2>/dev/null | tr -d '"' | grep -i 'v=spf1' | head -n1 || true)"
  echo "    $d: ${spf:-none}"
done

echo "==> Mail host A/AAAA"
for h in mail.globalorbitmail.cloud mail.theglobalorbit.com; do
  echo "    $h A:    $(dig +short A "$h" | tr '\n' ' ')"
  echo "    $h AAAA: $(dig +short AAAA "$h" | tr '\n' ' ')"
done

if ! command -v postconf >/dev/null 2>&1; then
  echo "ERROR: postconf not found" >&2
  exit 1
fi

echo "==> Before: inet_protocols=$(postconf -h inet_protocols)"

# Production decision: IPv6 has no PTR and SPF has no ip6: → IPv4 only
postconf -e "inet_protocols = ipv4"

# Keep submission/smtps listeners healthy on IPv4
postfix check 2>/dev/null || true
systemctl restart postfix

echo "==> After:  inet_protocols=$(postconf -h inet_protocols)"
echo "==> Listening:"
ss -lnt | grep -E ':25 |:465 |:587 ' || netstat -lnt | grep -E ':25 |:465 |:587 ' || true

echo
echo "DONE. Postfix uses IPv4 only (prevents Gmail IPv6AuthError)."
echo "Inbound MX has no AAAA → still delivers on IPv4."
echo "SMTP AUTH / Roundcube / Dovecot unchanged."
echo
echo "Verify:"
echo "  echo 'ipv4 test' | mail -r 'you@domain' -s 'ipv4-gmail' you@gmail.com"
echo "  mailq"
echo "  grep -i 'gmail\\|IPv6Auth\\|status=sent' /var/log/mail.log | tail -n 40"
echo
echo "To re-enable IPv6 later (ONLY after PTR + SPF ip6:${IPV6}):"
echo "  postconf -e 'inet_protocols = all' && systemctl restart postfix"
