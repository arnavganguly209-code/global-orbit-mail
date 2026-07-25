# Gmail IPv6AuthError — Postfix IPv4-only fix

## Root cause

Gmail bounce:

```text
550 5.7.1 IPv6AuthError
```

Outbound was leaving via IPv6 `2a02:4780:63:1d79::1`.

| Check | Result |
|-------|--------|
| IPv6 PTR | **MISSING** |
| SPF `ip6:` | **MISSING** (only `ip4:200.97.170.235` / `mx` / `a:`) |
| Mail MX AAAA | **None** (`mail.globalorbitmail.cloud` is A-only) |
| DKIM/DMARC | Separate; not the IPv6AuthError trigger |

Not Roundcube / SMTP AUTH / Dovecot / mailbox.

## Fix

```bash
postconf -e "inet_protocols = ipv4"
systemctl restart postfix
```

Or:

```bash
bash deploy/vps/fix-postfix-ipv4-only.sh
```

Also applied automatically by `mail-agent.sh` → `platform_ensure` / `domain.create` / `health.check`.

Inbound stays on IPv4 (MX has no AAAA). SMTP AUTH / submission / SMTPS unchanged.

## Re-enable IPv6 later (only when ready)

1. Set PTR for `2a02:4780:63:1d79::1` → `mail.theglobalorbit.com` (or chosen HELO)
2. Add `ip6:2a02:4780:63:1d79::1` to SPF for sending domains
3. Confirm DKIM signing
4. Then: `postconf -e "inet_protocols = all" && systemctl restart postfix`

## Verify

```bash
# From VPS
echo test | mail -s 'ipv4-gmail' you@gmail.com
mailq
grep -E 'gmail|IPv6Auth|status=sent' /var/log/mail.log | tail -n 50
```

Expect Gmail accept without IPv6AuthError. Then retry attachments / Outlook / Yahoo.
