# GLOBAL ORBIT MAIL — Roundcube Orbit Skin  
## Production Deployment Guide (Ubuntu)

**Target:** real Roundcube at `/var/www/roundcube`  
**Live URL:** https://webmail.globalorbitmail.cloud  

**Orbit** is the enterprise webmail skin for **webmail.globalorbitmail.cloud** — a Gmail-like Elastic extension with glass panels, premium blue accent, and light/dark mode. This guide deploys that skin only.  
It does **not** modify the Next.js `global-orbit-mail` application.

Do **not** edit IMAP, SMTP, database, or session settings.  
Do **not** replace `skins/elastic` — Orbit **extends** Elastic and requires it to remain installed.

---

## 1. Package verification (complete)

| Component | Status | Path in this repo |
|-----------|--------|-------------------|
| Skin metadata (`extends: elastic`) | OK | `roundcube/skins/orbit/meta.json` |
| Login template | OK | `roundcube/skins/orbit/templates/login.html` |
| Main CSS + min copy | OK | `roundcube/skins/orbit/styles/styles.css`, `styles.min.css` |
| Embed / editor CSS | OK | `roundcube/skins/orbit/styles/embed.css` |
| Login JS (UI only) | OK | `roundcube/skins/orbit/js/login.js` |
| Logo (official) | OK | `roundcube/skins/orbit/images/logo.png` (+ dark/small variants) |
| Favicon | OK | `roundcube/skins/orbit/images/favicon.svg` |
| Config snippet | OK | `roundcube/config/orbit-branding.inc.php` |
| Custom webfont files | N/A | Uses system fonts (`Segoe UI` / Helvetica / Arial) — no font files to deploy |

**Auth fields unchanged:** `_user`, `_pass`, `_token` — login.php / IMAP / SMTP untouched.

**Post-login styling:** `styles.css` / `styles.min.css` override Elastic chrome for inbox (mailbox list, message list, toolbar), compose (`#compose-content`, `#compose-body`), contacts (`#directorylist`, listings), and general settings panels (shared layout / buttons / popups). Templates for those tasks inherit from Elastic; only CSS branding is applied.

---

## 2. Exact files → `/var/www/roundcube/skins/orbit`

Copy the **entire** `orbit` folder so the server looks like this:

```text
/var/www/roundcube/skins/orbit/
├── meta.json
├── templates/
│   └── login.html
├── styles/
│   ├── styles.css
│   ├── styles.min.css
│   └── embed.css
├── js/
│   └── login.js
└── images/
    ├── logo.png
    ├── logo-dark.png
    ├── logo-small.png
    ├── logo-small-dark.png
    └── favicon.svg
```

**Required sibling (must already exist — do not delete):**

```text
/var/www/roundcube/skins/elastic/
```

Orbit CSS imports Elastic:

- `styles.css` → `@import url("../../elastic/styles/styles.min.css");`
- `embed.css` → `@import url("../../elastic/styles/embed.css");`

Resolved on the server as:

- `/var/www/roundcube/skins/elastic/styles/styles.min.css`
- `/var/www/roundcube/skins/elastic/styles/embed.css`

---

## 3. Config file to edit

**Edit this file only (branding keys):**

```text
/var/www/roundcube/config/config.inc.php
```

Optional helper (copy next to it, then include — or paste keys by hand):

```text
/var/www/roundcube/config/orbit-branding.inc.php
```

Source of the helper in this repo:

```text
roundcube/config/orbit-branding.inc.php
```

---

## 4. Exact PHP lines to set

Minimum required (add or replace existing keys in `config.inc.php`):

```php
$config['product_name'] = 'Global Orbit Mail';
$config['skin'] = 'orbit';
$config['support_url'] = 'https://theglobalorbit.com';
$config['display_product_info'] = 0;
```

**Critical line:**

```php
$config['skin'] = 'orbit';
```

Optional logo map (safe to include):

```php
$config['skin_logo'] = [
  'login[orbit]*' => '/images/logo.png',
  '*[orbit]*'     => '/images/logo.png',
];
```

**Include style (optional):** at the end of `config.inc.php`:

```php
include __DIR__ . '/orbit-branding.inc.php';
```

Do **not** overwrite DB, IMAP, SMTP, or `des_key` when merging.

---

## 5. Asset path verification

| Asset | How it is referenced | Resolves to |
|-------|----------------------|-------------|
| Logo | Template: `src="/images/logo.png"` (Roundcube skin path) | `/var/www/roundcube/skins/orbit/images/logo.png` → URL `…/skins/orbit/images/logo.png` |
| CSS | Roundcube loads skin `styles.min.css` (fallback `styles.css`) | `/var/www/roundcube/skins/orbit/styles/styles.min.css` |
| Elastic base CSS | `@import url("../../elastic/styles/styles.min.css")` | `/var/www/roundcube/skins/elastic/styles/styles.min.css` |
| Embed CSS | meta `embed_css_location` `/styles/embed.css` | `/var/www/roundcube/skins/orbit/styles/embed.css` |
| Login JS | Template: `skins/orbit/js/login.js` (site-root relative) | `/var/www/roundcube/skins/orbit/js/login.js` → URL `/skins/orbit/js/login.js` |
| Fonts | CSS `font-family` only | No files under `skins/orbit` |

**Browser checks after deploy:**

1. View source / Network → CSS: `skins/orbit/styles/styles.min.css` (or `styles.css`)
2. Logo request → `skins/orbit/images/logo.png` (HTTP 200)
3. Login JS → `skins/orbit/js/login.js` (HTTP 200)
4. Elastic CSS still loads via import (HTTP 200)

---

## 6. UI coverage after `$config['skin'] = 'orbit'`

| Surface | How styled | Notes |
|---------|------------|--------|
| Login | Custom `templates/login.html` + CSS + `js/login.js` | Full Orbit branding |
| Inbox / folders / toolbar | CSS overrides on Elastic layout | Mail logic unchanged |
| Compose | CSS on compose containers + buttons | Mail logic unchanged |
| Contacts | CSS on directory/listing chrome | Logic unchanged |
| Settings | Shared layout / form / dialog CSS | Logic unchanged |
| Dark / light mode | `dark_mode_support: true` in `meta.json` + CSS tokens | Elastic toggle; Orbit styles both themes |

---

## 7. Upgrade safety (branding will not be overwritten)

| Item | Upgrade-safe? | Why |
|------|---------------|-----|
| `skins/orbit/` | **Yes** | Custom skin directory; Roundcube upgrades replace `elastic` / core, not your `orbit` folder |
| `config/config.inc.php` | **Yes** (usually) | Local config is not in the upstream tarball; apt/`composer` upgrades should not wipe it if you preserve `config/` |
| `skins/elastic/` | Replaced on upgrade | **Expected** — Orbit imports Elastic; after an upgrade, keep Elastic installed and re-test Orbit CSS imports |
| Editing files inside `skins/elastic/` | **No** | Never put branding only in Elastic — always use `orbit` |

**Rules:**

1. Never copy Orbit files into `skins/elastic/`.
2. Never set branding by patching Roundcube PHP core.
3. Keep `$config['skin'] = 'orbit';` in `config.inc.php`.
4. After a Roundcube version upgrade: confirm `skins/elastic` exists, clear caches, hard-refresh.

**Optional backup before any Roundcube upgrade:**

```bash
sudo tar -czf /root/orbit-skin-backup-$(date +%F).tar.gz \
  /var/www/roundcube/skins/orbit \
  /var/www/roundcube/config/config.inc.php \
  /var/www/roundcube/config/orbit-branding.inc.php
```

---

## 8. Ubuntu deployment commands

Assume you deploy from a machine that has this repo’s `roundcube/skins/orbit` folder  
(or a tarball of it). Adjust `SRC` if your copy path differs.

### A. On your laptop — create a tarball

```bash
# From the global-orbit-mail repo root (or wherever roundcube/skins/orbit lives)
cd /path/to/global-orbit-mail
tar -czf orbit-skin.tar.gz -C roundcube/skins orbit
# Also pack the config snippet
tar -rzf orbit-skin.tar.gz -C roundcube config/orbit-branding.inc.php
```

Or from Windows (PowerShell), copy the folder via SCP:

```powershell
scp -r C:\Users\Admin\Desktop\ARNAB\global-orbit-mail\roundcube\skins\orbit user@YOUR_SERVER:/tmp/orbit
scp C:\Users\Admin\Desktop\ARNAB\global-orbit-mail\roundcube\config\orbit-branding.inc.php user@YOUR_SERVER:/tmp/orbit-branding.inc.php
```

### B. On the Ubuntu Roundcube server

```bash
# 1) Confirm Roundcube + Elastic exist
ls -la /var/www/roundcube
ls -la /var/www/roundcube/skins/elastic
test -f /var/www/roundcube/config/config.inc.php && echo "config OK"

# 2) Backup current config and any existing orbit skin
sudo cp -a /var/www/roundcube/config/config.inc.php \
  /var/www/roundcube/config/config.inc.php.bak.$(date +%Y%m%d%H%M%S)
sudo mkdir -p /var/www/roundcube/skins
if [ -d /var/www/roundcube/skins/orbit ]; then
  sudo mv /var/www/roundcube/skins/orbit \
    /var/www/roundcube/skins/orbit.bak.$(date +%Y%m%d%H%M%S)
fi

# 3) Install Orbit skin (example if files are in /tmp/orbit)
sudo rm -rf /var/www/roundcube/skins/orbit
sudo cp -a /tmp/orbit /var/www/roundcube/skins/orbit
# If using tarball instead:
#   sudo tar -xzf /tmp/orbit-skin.tar.gz -C /var/www/roundcube/skins

# 4) Install config snippet (optional include)
sudo cp /tmp/orbit-branding.inc.php /var/www/roundcube/config/orbit-branding.inc.php

# 5) Ownership + permissions (Debian/Ubuntu www-data)
sudo chown -R www-data:www-data /var/www/roundcube/skins/orbit
sudo find /var/www/roundcube/skins/orbit -type d -exec chmod 755 {} \;
sudo find /var/www/roundcube/skins/orbit -type f -exec chmod 644 {} \;
sudo chown www-data:www-data /var/www/roundcube/config/orbit-branding.inc.php
sudo chmod 640 /var/www/roundcube/config/orbit-branding.inc.php

# 6) Enable skin in config — edit carefully
sudo nano /var/www/roundcube/config/config.inc.php
```

In `nano`, ensure these lines exist (and remove any other `$config['skin'] = ...`):

```php
$config['product_name'] = 'Global Orbit Mail';
$config['skin'] = 'orbit';
$config['support_url'] = 'https://theglobalorbit.com';
$config['display_product_info'] = 0;
```

If using the include file, also add **once** at the bottom:

```php
include __DIR__ . '/orbit-branding.inc.php';
```

(If you use the include, avoid duplicating the same keys twice.)

```bash
# 7) Verify PHP syntax of config
sudo -u www-data php -l /var/www/roundcube/config/config.inc.php

# 8) Clear Roundcube caches
sudo rm -rf /var/www/roundcube/temp/cache \
            /var/www/roundcube/temp/cache_* \
            /var/www/roundcube/temp/js_cache \
            /var/www/roundcube/temp/*.js 2>/dev/null || true
# Keep directory writable
sudo mkdir -p /var/www/roundcube/temp
sudo chown -R www-data:www-data /var/www/roundcube/temp
sudo chmod 775 /var/www/roundcube/temp

# 9) Quick file presence check
ls -la /var/www/roundcube/skins/orbit/meta.json
ls -la /var/www/roundcube/skins/orbit/templates/login.html
ls -la /var/www/roundcube/skins/orbit/styles/styles.min.css
ls -la /var/www/roundcube/skins/orbit/js/login.js
ls -la /var/www/roundcube/skins/orbit/images/logo.png
grep -n "skin" /var/www/roundcube/config/config.inc.php | head

# 10) Reload PHP-FPM / web server if needed (pick what you use)
sudo systemctl reload php8.1-fpm 2>/dev/null || \
sudo systemctl reload php8.2-fpm 2>/dev/null || \
sudo systemctl reload php8.3-fpm 2>/dev/null || true
sudo systemctl reload nginx 2>/dev/null || sudo systemctl reload apache2 2>/dev/null || true
```

### C. One-liner path check (HTTP from server)

```bash
curl -sI "https://webmail.globalorbitmail.cloud/skins/orbit/styles/styles.min.css" | head -n 1
curl -sI "https://webmail.globalorbitmail.cloud/skins/orbit/images/logo.png" | head -n 1
curl -sI "https://webmail.globalorbitmail.cloud/skins/orbit/js/login.js" | head -n 1
```

Expect `HTTP/2 200` or `HTTP/1.1 200`.

---

## 9. Rollback

```bash
sudo nano /var/www/roundcube/config/config.inc.php
# set:
#   $config['skin'] = 'elastic';
sudo rm -rf /var/www/roundcube/temp/cache /var/www/roundcube/temp/cache_* 2>/dev/null || true
```

Restore config from backup if needed:

```bash
sudo cp -a /var/www/roundcube/config/config.inc.php.bak.YYYYMMDDHHMMSS \
  /var/www/roundcube/config/config.inc.php
```

---

## 10. Final production checklist

### Pre-flight

- [ ] Ubuntu host has Roundcube at `/var/www/roundcube`
- [ ] `/var/www/roundcube/skins/elastic` exists and works
- [ ] You have SSH + `sudo`
- [ ] Backup of `config.inc.php` taken
- [ ] Orbit package verified locally (section 1)

### Install

- [ ] `/var/www/roundcube/skins/orbit/` matches the tree in section 2
- [ ] Permissions: dirs `755`, files `644`, owner `www-data`
- [ ] `config.inc.php` contains `$config['skin'] = 'orbit';`
- [ ] `product_name` / `support_url` / `display_product_info` set
- [ ] `php -l` on config passes
- [ ] Caches cleared under `/var/www/roundcube/temp`

### Verify in browser (hard refresh / private window)

- [ ] https://webmail.globalorbitmail.cloud shows Orbit login (not plain Elastic)
- [ ] Logo ~220–240px, product name **GLOBAL ORBIT MAIL**
- [ ] Glass card + dark animated background
- [ ] Login still works (same email/password as before)
- [ ] Network: `skins/orbit/styles/styles.min.css` = 200
- [ ] Network: `skins/orbit/images/logo.png` = 200
- [ ] Network: `skins/orbit/js/login.js` = 200
- [ ] Inbox / sidebar / toolbar look branded
- [ ] Compose opens and sends as before
- [ ] Contacts list chrome looks consistent
- [ ] Settings pages open and save as before
- [ ] Footer credit: Software Developed by **GLOBAL ORBIT**
- [ ] No visible “Roundcube” product branding on login (version footer hidden)

### Upgrade policy

- [ ] Branding lives only under `skins/orbit` + `config.inc.php`
- [ ] No edits inside `skins/elastic` for branding
- [ ] Backup tarball of `skins/orbit` + config kept off-box

### Done when

- [ ] Production login URL itself is the premium Orbit UI
- [ ] Mail authentication and mail functions unchanged
- [ ] Next.js app was not modified for this deploy

---

## Source package location (this repo)

```text
global-orbit-mail/roundcube/
├── DEPLOY.md                          ← this file
├── README.md
├── config/orbit-branding.inc.php
└── skins/orbit/                       ← copy this folder → /var/www/roundcube/skins/orbit
```

**Next.js / Netlify code is out of scope for this deployment.**
