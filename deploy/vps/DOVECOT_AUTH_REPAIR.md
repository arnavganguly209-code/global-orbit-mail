# GLOBAL ORBIT MAIL — Dovecot MySQL auth repair

## Root cause

Orbit uses **PostgreSQL + Prisma** for the control plane.

Production **Dovecot** authenticates against **MySQL**:

| Item | Value |
|------|-------|
| Database | `mailserver` |
| Table | `virtual_users` |
| Query | `SELECT email,password FROM virtual_users WHERE email='%u'` |
| Scheme | **SHA512-CRYPT** (`$6$…`) — not bcrypt, not argon |

If Orbit only wrote Postgres `virtual_users`, `doveadm auth test` returns `passdb: auth failed`.

## Fix path

1. Mailbox create / password reset hashes with **SHA512-CRYPT**
2. Upserts **MySQL** `mailserver.virtual_users`
3. Creates **Maildir** under `/var/mail/vhosts/<domain>/<user>`
4. Prove with `doveadm auth test` → `passdb: user authenticated`

## Environment (Orbit app + VPS agent)

```bash
# MySQL Dovecot passdb (required for auth sync from the app)
MAIL_MYSQL_HOST=127.0.0.1
MAIL_MYSQL_PORT=3306
MAIL_MYSQL_USER=mailuser
MAIL_MYSQL_PASSWORD=secret
MAIL_MYSQL_DATABASE=mailserver
# or:
# MAIL_MYSQL_URL=mysql://mailuser:secret@127.0.0.1:3306/mailserver

DOVECOT_PASS_SCHEME=SHA512-CRYPT
VMAIL_BASE=/var/mail/vhosts
MAIL_PROVISION_MODE=local
MAIL_AGENT_SCRIPT=/opt/global-orbit/bin/mail-agent.sh
```

## One-shot repair on the mail VPS

```bash
sudo cp deploy/vps/mail-agent.sh /opt/global-orbit/bin/mail-agent.sh
sudo chmod 755 /opt/global-orbit/bin/mail-agent.sh

# Optional: align Dovecot SQL config with MySQL mailserver
sudo cp deploy/vps/dovecot-sql.conf.ext /etc/dovecot/dovecot-sql.conf.ext
# edit connect= then:
sudo systemctl reload dovecot

bash deploy/vps/fix-dovecot-auth.sh user@domain.com 'TheRealPassword'
```

Expected:

```
SUCCESS: passdb: user authenticated
```

## Then verify product path

1. Roundcube login at `https://webmail.globalorbitmail.cloud`
2. Send email
3. Receive email

## Orbit admin resync

`POST /api/admin/mailboxes/resync-auth` re-pushes existing SHA512-CRYPT
`mailPasswordHash` values into MySQL. Rows still storing bcrypt cannot be
rehashed without the plaintext — reset those mailbox passwords in Orbit.
