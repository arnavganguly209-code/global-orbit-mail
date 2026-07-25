# Production Mail Delivery Report — Global Orbit Mail

**Date:** 2026-07-25  
**Scope:** Outbound delivery consistency + Roundcube attachments (Workspace/Zoho-class)  
**Constraint:** No Postfix auth / Dovecot SQL / IMAP rewrites; local commit only (no push)

---

## Executive summary

Plain Roundcube send/receive is **working** in production. Remaining failures cluster into two root causes:

1. **Attachments** — PHP `upload_max_filesize` is **8M**. Roundcube returns:  
   `The uploaded file exceeds the maximum size of 8.0 MB.`  
   (Observed even when probing the upload API; larger real attachments fail.)

2. **External recipient inconsistency** — identity/DNS gaps:
   - **PTR** for `200.97.170.235` → `mail.theglobalorbit.com`
   - Customer MX/SPF advertise **`mail.globalorbitmail.cloud`**
   - **`zenspanp.com` has no public DKIM** (`orbit._domainkey` / `dkim._domainkey` missing)
   - **`zenspanp.com` DMARC** missing/unreachable  
   Gmail/Outlook/Yahoo heavily weight PTR↔HELO alignment + DKIM. SPF alone is not enough.

IP is **not** listed on Spamhaus / SpamCop / Barracuda / SORBS (checked from this workstation).

---

## Verified PASS (live)

| Check | Evidence |
|-------|----------|
| Roundcube login | HTTP session OK |
| IMAP / folders | INBOX, Sent, Drafts, Trash, Junk list OK |
| SMTP auth + send (no attachment) | `display_message` confirmation; stamp in **Sent** + **INBOX** (self-send) |
| Receive (self / prior Gmail) | User-reported + Inbox list |
| Orbit Admin provisioning | User-reported PASS |
| MX `zenspanp.com` | `10 mail.globalorbitmail.cloud` |
| SPF `zenspanp.com` | `v=spf1 mx a:mail.globalorbitmail.cloud -all` |
| TLS webmail | HTTPS 200 |
| Blacklists | clean |

---

## FAIL / gaps (live)

| Check | Finding | Fix |
|-------|---------|-----|
| Attachment upload | PHP limit **8.0 MB** | `harden-mail-delivery.sh` → PHP 25M / post 30M |
| Nginx body size | Likely default 1m–8m | `client_max_body_size 30m` |
| Postfix `message_size_limit` | Unknown until audit on VPS | set `26214400` (25 MiB) |
| Roundcube `max_message_size` | Not confirmed included | `attachments-mime.inc.php` |
| Roundcube temp | Must be www-data writable | harden script |
| HELO / PTR | PTR=`mail.theglobalorbit.com` vs MX host `.cloud` | `myhostname`/`smtp_helo_name` = PTR host |
| DKIM `zenspanp.com` | **Missing** in public DNS | `ensure-opendkim-domain.sh` + publish TXT |
| DMARC `zenspanp.com` | Missing | publish `_dmarc` TXT |
| Outlook / Yahoo / Gmail external | Inconsistent (expected with no DKIM + PTR mismatch) | identity + DKIM |
| Bounce / queue | Needs VPS `mailq` / mail.log | `audit-mail-delivery.sh` |

---

## Decision: Roundcube SMTP transport

Keep **`ssl://127.0.0.1:465`** (already proven for send without attachment).  
Do not use PHP `tls://:587` (implicit TLS / wrong version number).

---

## Files added / updated (this commit)

| Path | Purpose |
|------|---------|
| `roundcube/config/attachments-mime.inc.php` | 25M message size, temp, MIME, HELO hint |
| `deploy/vps/harden-mail-delivery.sh` | PHP + Nginx + Postfix size + PTR HELO + Roundcube includes |
| `deploy/vps/audit-mail-delivery.sh` | Read-only Workspace-class checklist |
| `deploy/vps/ensure-opendkim-domain.sh` | Per-domain OpenDKIM key + DNS TXT to publish |
| `scripts/e2e-roundcube-attachments.mjs` | Plain/HTML/PNG/PDF/ZIP send probe |
| `scripts/probe-roundcube-upload.mjs` | Upload API diagnostics |
| `lib/dns/records.ts` | SPF now includes `ip4:` mail server address |
| `scripts/test-dns-generation.ts` | Expects new SPF form |

---

## Required VPS commands (must run on mail host)

```bash
cd /path/to/global-orbit-mail && git pull   # when you choose to deploy

# 1) Attachment limits + Postfix size + HELO=PTR
bash deploy/vps/harden-mail-delivery.sh

# 2) DKIM for customer domain (example)
bash deploy/vps/ensure-opendkim-domain.sh zenspanp.com orbit
# Publish printed TXT at orbit._domainkey.zenspanp.com

# 3) Audit
bash deploy/vps/audit-mail-delivery.sh zenspanp.com

# 4) Queue / logs after test sends
mailq
tail -n 200 /var/log/mail.log
```

### DNS to publish for `zenspanp.com` (Workspace-class)

```text
MX    @                    10 mail.globalorbitmail.cloud.
TXT   @                    v=spf1 mx a:mail.globalorbitmail.cloud ip4:200.97.170.235 -all
TXT   orbit._domainkey     (from ensure-opendkim-domain.sh / Orbit admin DNS panel)
TXT   _dmarc               v=DMARC1; p=none; rua=mailto:postmaster@zenspanp.com
```

### PTR (provider panel / IP owner)

Either:
- Set PTR `200.97.170.235` → `mail.globalorbitmail.cloud`, **or**
- Keep PTR `mail.theglobalorbit.com` and ensure Postfix `myhostname`/`smtp_helo_name` match it (harden script default).

---

## Live test results (this session)

### Plain send (Roundcube)

- Confirmation: **yes**
- Sent folder contains stamp: **yes**
- Inbox (self): **yes**

### Attachment upload probe

- Roundcube message: **exceeds maximum size of 8.0 MB**  
- Root cause: PHP upload limit, not MIME encoding

### External Gmail / Outlook / Yahoo

- Cannot fully certify from this workstation (no VPS log access; recipient inboxes not controlled here)
- After harden + DKIM + PTR/HELO alignment, re-test with:

```bash
RC_USER=recaption@zenspanp.com RC_PASS='…' node scripts/e2e-roundcube-attachments.mjs
# then send to Gmail/Outlook/Yahoo and confirm reply
```

---

## Checklist status

| Requirement | Status |
|-------------|--------|
| 1 Outbound SMTP | PASS (plain); external pending DKIM/PTR |
| 2 Inbound | PASS (self + user Gmail report) |
| 3 MIME attachments | BLOCKED by 8M PHP until harden |
| 4 Roundcube upload | FAIL @ 8M — fix scripted |
| 5 PHP upload limits | FAIL 8M → script sets 25M |
| 6 Nginx body size | Fix scripted (30m) |
| 7 Postfix message_size_limit | Fix scripted (25 MiB) |
| 8 Dovecot quota | Audit scripted |
| 9 Roundcube temp | Fix scripted |
| 10 Mail queue | Audit scripted |
| 11 DNS MX/SPF/DKIM/DMARC | MX/SPF OK; DKIM/DMARC fail for zenspanp |
| 12 Reverse DNS | Mismatch vs .cloud MX host |
| 13 TLS | PASS (webmail + prior SMTP TLS) |
| 14 Recipient restrictions | Not changed; inspect Postfix restrictions on VPS |
| 15 SMTP logs | VPS `mail.log` / Roundcube `logs/smtp` |
| 16 Bounce handling | `notify_classes` set in harden |
| 17–19 Gmail/Outlook/Yahoo | Pending post-harden DKIM + HELO |

---

## Bottom line

**Do not chase Postfix AUTH or Dovecot** — those are green.  

Apply **`harden-mail-delivery.sh`** + **DKIM DNS for each domain** + **HELO=PTR**, then re-run attachment + external recipient tests. Until PHP leaves 8M and DKIM is published, attachment sends and some external inboxes will keep failing.
