# Roundcube SMTP AUTH after STARTTLS (1.6.x)

## Symptom

- OpenSSL / manual STARTTLS on `:587` shows `250-AUTH PLAIN`
- Roundcube logs: `SMTP server does not support authentication`
- Roundcube capability dump still lists `STARTTLS` and **no** `AUTH`

That dump is the **cleartext** submission EHLO. Postfix only offers AUTH after TLS.

## Root cause (Roundcube only)

Roundcube 1.6.11 (`rcube_smtp.php`):

1. Parses `smtp_host` with `parse_host_uri`
2. Sets `$use_tls = ($scheme === 'tls')`
3. Calls `$this->conn->starttls()` **only if** `$use_tls`

If config is `localhost:587` / `127.0.0.1:587` / hostname without `tls://`, Roundcube never STARTTLSes. Auth sees pre-TLS extensions → error.

Obsolete `smtp_port` / `smtp_server` (removed in 1.6) often leave hosts without the `tls://` prefix after upgrades.

## Fix

```php
$config['smtp_host'] = 'tls://127.0.0.1:587';
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

Comment out any `$config['smtp_server']` / `$config['smtp_port']`.

Files in this repo:

- `roundcube/config/smtp-transport.inc.php`
- `deploy/vps/fix-roundcube-smtp.sh`

## Reproduce offline

```bash
node scripts/reproduce-roundcube-smtp-auth.mjs
```

## VPS apply

```bash
bash deploy/vps/fix-roundcube-smtp.sh /var/www/roundcube
```

Do **not** change Postfix or Dovecot for this bug.
