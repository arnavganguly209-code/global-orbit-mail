# Roundcube SMTP transport — SSL on 465 (not PHP tls:// on 587)

## Evidence

| Test | Result |
|------|--------|
| `openssl s_client -starttls smtp -connect 127.0.0.1:587` | Works; AUTH after STARTTLS |
| `stream_socket_client("tls://127.0.0.1:587")` | Fails: `SSL routines::wrong version number` |
| Roundcube without encryption on `:587` | Sees cleartext EHLO (STARTTLS listed, **no AUTH**) |

Port **587** speaks plain SMTP first, then STARTTLS.  
Port **465** speaks **implicit TLS** from the first byte.

PHP stream wrappers `tls://` and `ssl://` both mean **implicit TLS**. They are correct for **465**, wrong for **587**.

## Roundcube 1.6 semantics (important)

In `rcube_smtp.php`:

- `ssl://host:465` → host kept as `ssl://host`, Net_SMTP uses implicit TLS
- `tls://host:587` → scheme stripped; cleartext connect; then `Net_SMTP::starttls()`
- plain `host:587` → cleartext only; `auth(..., false)` skips Net_SMTP auto-STARTTLS → no AUTH

So Roundcube’s config token `tls://` ≠ PHP `stream_socket_client('tls://…')`.  
Given production confusion / failures around `tls://…:587`, this project standardizes on:

```php
$config['smtp_host'] = 'ssl://127.0.0.1:465';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['smtp_auth_type'] = 'PLAIN';
$config['smtp_conn_options'] = [
  'ssl' => [
    'verify_peer' => true,
    'verify_peer_name' => true,
    'peer_name' => 'mail.globalorbitmail.cloud',
  ],
];
```

Comment out obsolete `smtp_server` / `smtp_port`.

## Files

- `roundcube/config/smtp-transport.inc.php`
- `deploy/vps/fix-roundcube-smtp.sh`
- `scripts/reproduce-roundcube-smtp-auth.mjs` — offline mock
- `scripts/test-roundcube-smtp-php.php` — run **on the mail VPS**

## Apply on VPS

```bash
bash deploy/vps/fix-roundcube-smtp.sh /var/www/roundcube
php scripts/test-roundcube-smtp-php.php
# then send a message from Roundcube UI
```

Do **not** change Postfix or Dovecot for this issue.
