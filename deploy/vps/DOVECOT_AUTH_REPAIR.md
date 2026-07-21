# GLOBAL ORBIT MAIL — Dovecot auth repair (production)

## Symptom

Roundcube reaches Dovecot but:

```
passdb: auth failed
```

## Cause

Orbit stored the bcrypt hash on `mailboxes.mailPasswordHash` but Dovecot passdb
queries `virtual_users`. Earlier agent stubs returned success without syncing.

## Fix (on the mail VPS)

### 1. Deploy updated agent + SQL config

```bash
cd /path/to/global-orbit-mail
git pull
sudo cp deploy/vps/mail-agent.sh /opt/global-orbit/bin/mail-agent.sh
sudo chmod 755 /opt/global-orbit/bin/mail-agent.sh
sudo cp deploy/vps/dovecot-sql.conf.ext /etc/dovecot/dovecot-sql.conf.ext
# Edit connect= to match DATABASE_URL
sudo nano /etc/dovecot/dovecot-sql.conf.ext
```

Ensure `/etc/dovecot/conf.d/auth-sql.conf.ext` uses that file for passdb + userdb,
and `default_pass_scheme = BLF-CRYPT`.

```bash
sudo doveadm reload
# or
sudo systemctl reload dovecot
```

### 2. Resync existing mailboxes into virtual_users

```bash
cd /path/to/global-orbit-mail
npx tsx scripts/resync-dovecot-auth.ts
```

Or from Orbit Super Admin (CSRF session):

`POST /api/admin/mailboxes/resync-auth`

### 3. Prove auth

```bash
doveadm auth test recaption@zenspanp.com 'THE_REAL_PASSWORD'
```

Must print:

```
passdb: user authenticated
```

### 4. Roundcube

Login at https://webmail.globalorbitmail.cloud with the same mailbox + password.

### 5. New mailboxes

Create from Orbit → credentials are written to `virtual_users` automatically
(and Maildir is created by the agent).
