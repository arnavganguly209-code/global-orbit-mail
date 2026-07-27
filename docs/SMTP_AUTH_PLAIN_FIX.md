# SMTP AUTH PLAIN — Production Evidence

## Root cause (not a guess)

Live SMTP on `mail.globalorbitmail.cloud`:

| Test | Result |
|------|--------|
| EHLO AUTH advertisement | **`250-AUTH PLAIN`** only |
| `AUTH PLAIN` | **`235 2.7.0 Authentication successful`** |
| `AUTH LOGIN` | **`535 5.7.8 Invalid authentication mechanism`** |

Mailbox `recaption@zenspanp.com` credentials are valid.  
Roundcube failed because it was using **LOGIN** (or auto that preferred LOGIN).

## Fix

```php
$config['smtp_auth_type'] = 'PLAIN';
$config['smtp_host'] = 'ssl://127.0.0.1:465';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
```

## VPS apply

```bash
cd /path/to/global-orbit-mail
git pull origin main
bash deploy/vps/fix-smtp-auth-plain.sh
RC_USER='recaption@zenspanp.com' RC_PASS='@Zenspa12345' RC_TO='you@gmail.com' \
  bash deploy/vps/fix-smtp-auth-plain.sh
```

## External proof (from any machine)

```bash
node scripts/e2e-smtp-auth-plain.mjs
```
