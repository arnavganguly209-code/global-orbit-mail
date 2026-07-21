# Phase 5A — Real Provisioning Engine  
## Production Readiness Report

**Scope:** Backend only. No landing/webmail/Orbit UI redesign.

**Date:** 2026-07-21

---

## APIs completed

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/admin/domains` | List / create domain + auto DNS + DKIM + provision |
| GET/PUT/PATCH/DELETE | `/api/admin/domains/[id]` | Get (with DNS JSON) / update / delete + deprovision |
| GET | `/api/admin/dns?domainId=` | Structured MX/SPF/DKIM/DMARC/Autodiscover/Autoconfig JSON |
| POST/GET | `/api/admin/verify` | Live DNS + SSL verification report |
| GET/POST | `/api/admin/mailboxes` | List / create + VPS provision |
| PUT/PATCH/DELETE | `/api/admin/mailboxes/[id]` | Update / suspend / activate / delete + provision |
| POST | `/api/admin/mailboxes/[id]/reset-password` | Hash + provision password (`generate` supported) |
| GET/POST | `/api/admin/mailboxes/[id]/aliases` | Aliases + alias sync |
| GET/POST | `/api/admin/mailboxes/[id]/forwarders` | Forwarders + sync |
| POST | `/api/admin/password` | Generate secure password; optional apply to mailbox |
| GET | `/api/admin/storage` | Quota / used / percent (+ optional agent sync) |
| GET | `/api/admin/system` | Postfix, Dovecot, Rspamd, Redis, Roundcube, Nginx, PHP, DB, CPU/RAM/Disk |
| GET | `/api/admin/audit` | Audit trail (existing; all new actions write here) |

Existing customer domain/mailbox APIs reuse the same repositories/services (real provision path).

---

## Database tables / Prisma models

**Migration:** `prisma/migrations/20260721210000_phase5a_provisioning/migration.sql`

| Model / table | Change |
|---------------|--------|
| `domains` | `dkimSelector`, `dkimPublicKey`, `dkimPrivateKey`, `provisionedAt` |
| `mailboxes` | `mailPasswordHash`, vacation fields, `provisionedAt` |
| `provision_jobs` | New job queue for every mail-agent action |
| `virtual_domains` / `virtual_users` / `virtual_aliases` | Created at runtime by SQL fallback (Postfix-style maps) |

Existing: `dns_records`, `verifications`, `aliases`, `forwarders`, `mailbox_quotas`, `audit_logs`.

---

## Services

| Service | Path |
|---------|------|
| Domain | `services/domains` |
| Mailbox | `services/mailboxes` |
| DNS engine | `services/dns/engine.ts`, `lib/dns/records.ts` |
| DNS verify (live) | `services/dns/verification.ts` |
| DNS admin JSON | `services/dns/admin.ts` |
| Mail engine | `services/provisioning/mail-engine.ts` |
| Password | `services/provisioning/password.ts`, `services/password` |
| Storage | `services/storage` |
| System health | `services/system/health.ts` |
| Repositories | `repositories/domain.repository.ts`, `mailbox.repository.ts` |

---

## Validation (Zod)

`lib/validations/admin.ts` — domain, mailbox, vacation, password generate/apply, verify, storage query.

---

## Security

- Admin session gate (`requireAdminActor` / `requireAdminMutation`)
- CSRF on mutations
- RBAC via `requirePermission` on verify / system / storage / password
- API rate limits (`lib/api/rate-limit.ts`)
- Passwords hashed (bcrypt + `{BLF-CRYPT}` for Dovecot)
- DKIM private keys stored server-side only (never returned in DNS public JSON `p=` only)
- Input validation with Zod (no `any` in new services)

---

## VPS agent

`deploy/vps/mail-agent.sh` → install as `/opt/global-orbit/bin/mail-agent.sh`

Env: `MAIL_PROVISION_MODE=local|ssh`, `MAIL_AGENT_SCRIPT`, SSH_* vars (see `.env.example`).

If the agent binary is missing, the engine falls back to PostgreSQL `virtual_*` tables so provisioning remains durable.

---

## Deploy steps (VPS)

```bash
cd /path/to/global-orbit-mail
npx prisma migrate deploy
npx prisma generate
sudo mkdir -p /opt/global-orbit/bin
sudo cp deploy/vps/mail-agent.sh /opt/global-orbit/bin/mail-agent.sh
sudo chmod 755 /opt/global-orbit/bin/mail-agent.sh
# set MAIL_PROVISION_MODE=local (or ssh) in .env
pm2 restart <app>
```

---

## Production readiness

| Item | Status |
|------|--------|
| Real Prisma persistence | Yes |
| Real DNS generation (MX/SPF/DKIM/DMARC/Autodiscover/Autoconfig) | Yes |
| Real DNS verification (`dns.promises` + TLS) | Yes |
| Mailbox CRUD + suspend/password/quota/alias/forwarder/vacation | Yes |
| Audit logging on actions | Yes |
| System health probes | Yes |
| Storage tracking | Yes |
| UI redesign | Not touched (per scope) |
| Postfix/Dovecot map wiring on host | Requires agent install + Postfix SQL maps pointing at `virtual_*` |

**Phase 5A backend is complete.** Phase 5B (UI wiring / deeper host hardening) should not start until migrate + agent are live on the Ubuntu VPS.
