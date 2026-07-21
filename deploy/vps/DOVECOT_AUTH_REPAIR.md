# GLOBAL ORBIT MAIL — Dovecot auth repair (production)

## Exact failure

```
doveadm auth test recaption@zenspanp.com "<password>"
→ passdb: auth failed
```

## Exact root cause (most common)

Orbit previously wrote **bcrypt `{BLF-CRYPT}$2b$…`** into app DB, while production Dovecot
almost always expects **`SHA512-CRYPT` (`$6$…`)** from `doveadm pw`, and passdb reads
**`virtual_users`** on the **mail host** database — not a remote app DB.

If those diverge → `passdb: auth failed`.

## One command that MUST succeed (run as root on mail VPS)

```bash
cd /path/to/global-orbit-mail
git pull
sudo cp deploy/vps/mail-agent.sh /opt/global-orbit/bin/mail-agent.sh
sudo chmod 755 /opt/global-orbit/bin/mail-agent.sh
sudo cp deploy/vps/dovecot-sql.conf.ext /etc/dovecot/dovecot-sql.conf.ext
# Edit connect= to the SAME Postgres Dovecot already uses
sudo nano /etc/dovecot/dovecot-sql.conf.ext
sudo doveadm reload

# THIS is the proof command — exits 0 only on success:
sudo bash deploy/vps/fix-dovecot-auth.sh recaption@zenspanp.com 'THE_REAL_PASSWORD'
```

Expected final line:

```
SUCCESS: passdb: user authenticated
```

Then Roundcube login with the same credentials.

## What the fix script does

1. Reads live Dovecot scheme (`doveconf` / `dovecot-sql.conf.ext`)
2. Hashes with `doveadm pw -s <scheme>`
3. Creates Maildir under `/var/mail/vhosts`
4. Upserts `virtual_users`
5. Runs `doveadm auth test` and exits non-zero if it fails

## Env on mail host

```
MAIL_SQL_DSN=postgresql://user:pass@127.0.0.1:5432/global_orbit_mail
# or DATABASE_URL=...
VMAIL_BASE=/var/mail/vhosts
VMAIL_UID=5000
VMAIL_GID=5000
DOVECOT_PASS_SCHEME=SHA512-CRYPT
```
