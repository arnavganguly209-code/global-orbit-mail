# GLOBAL ORBIT MAIL — Premium Orbit Skin Deploy

Live target: https://webmail.globalorbitmail.cloud/

## What this package is
Custom Roundcube skin `orbit` (extends **elastic** — update-safe).  
Replaces login + chrome UI to match the attached premium references.  
**Does not** change IMAP, SMTP, Postfix, Dovecot, or auth logic.

## Assets
- `skins/orbit/images/logo.png` — official GLOBAL ORBIT PVT LTD logo (transparent use)
- `skins/orbit/images/login-earth.png` — space/Earth hero
- `skins/orbit/templates/login.html` — split luxury login
- `skins/orbit/styles/styles.css` — gold/dark dashboard + login
- `skins/orbit/js/login.js` — remember me, show password, caps lock, stars
- `config/orbit-branding.inc.php` — `skin=orbit`, product name

## Deploy on VPS (required for live)

```bash
cd /path/to/global-orbit-mail
git pull origin main
bash deploy/vps/deploy-orbit-skin.sh
```

Hard-refresh the browser: `Ctrl+Shift+R`

## Verify backend unchanged

```bash
# SMTP AUTH still PLAIN
# Roundcube still uses ssl://127.0.0.1:465
grep smtp_host /var/www/roundcube/config/smtp-transport.inc.php
doveadm auth test 'user@domain' 'password'
ss -tlnp | grep -E ':465|:587|:993'
```

## Rollback

```bash
# deploy script creates skins/orbit.bak.TIMESTAMP
rm -rf /var/www/roundcube/skins/orbit
mv /var/www/roundcube/skins/orbit.bak.YYYYMMDDHHMMSS /var/www/roundcube/skins/orbit
# restore config.inc.php.bak.skin.*
```
