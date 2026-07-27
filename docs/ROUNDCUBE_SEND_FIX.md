# Roundcube Send Failure — Production SMTP Fix

**Symptom:** Roundcube login OK, receive OK, send shows  
`Connection Error (Failed to reach the server!)`

**Not a DNS problem.** This is Roundcube AJAX timing out while PHP waits on SMTP.

## Most likely root cause (after `harden-deliverability.sh`)

1. **OpenDKIM milter** set to `inet:localhost:8891` while OpenDKIM is **not listening**  
   → Postfix SMTP session stalls → PHP exceeds request time → browser shows  
   **Failed to reach the server!**
2. Invalid `smtpd_sender_login_maps = static:`
3. Roundcube `smtp-transport.inc.php` not last / TLS verify on `127.0.0.1:465`

## Proven transport (do not change)

```php
$config['smtp_host'] = 'ssl://127.0.0.1:465';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
```

Do **not** use PHP `tls://127.0.0.1:587`.

## Deploy on VPS (exact commands)

```bash
cd /path/to/global-orbit-mail   # or: cd /var/www/global-orbit-mail
git pull origin main

# Log-driven fix (clears hung milters, restores SMTPS, Roundcube smtp, timeouts)
bash deploy/vps/fix-roundcube-send.sh

# Optional: prove AUTH+accept with a real mailbox
RC_USER='recaption@zenspanp.com' RC_PASS='YOUR_PASSWORD' \
  RC_TO='your@gmail.com' bash deploy/vps/fix-roundcube-send.sh
```

Then in the browser:

1. https://webmail.globalorbitmail.cloud  
2. Compose → send to Gmail  
3. Confirm no connection error  
4. Gmail inbox + Show original  

## Verify commands (on VPS)

```bash
tail -100 /var/log/mail.log
journalctl -u postfix -n 80 --no-pager
postconf -n | grep -Ei 'milter|relay|myhostname|inet_protocols|smtp_helo'
ss -tlnp | grep -E ':25|:465|:587|:8891'
postconf -h smtpd_milters non_smtpd_milters
tail -80 /var/www/roundcube/logs/errors.log
tail -80 /var/www/roundcube/logs/smtp
php -r '$c=stream_context_create(["ssl"=>["verify_peer"=>false,"verify_peer_name"=>false]]);
$f=@stream_socket_client("ssl://127.0.0.1:465",$e,$s,10,STREAM_CLIENT_CONNECT,$c);
echo $f?"OK\n":"FAIL $s\n";'
```

## What the fix script changes

| Item | Action |
|------|--------|
| Hung milter | Clear milters if `:8891` down; else keep with 5–10s timeouts |
| `smtpd_sender_login_maps` | Removed |
| Recipient restrictions | Auth-safe (no hang path for SASL) |
| `master.cf` | Ensure `smtps` (465) + `submission` (587) |
| Roundcube | Force `smtp-transport.inc.php` **last** |
| PHP/Nginx | Raise timeouts so SMTP cannot trip AJAX |

## Regression guard

`harden-deliverability.sh` no longer enables milters unless OpenDKIM is listening, and no longer sets `smtpd_sender_login_maps = static:`.
