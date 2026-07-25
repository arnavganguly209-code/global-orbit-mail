# Commercial Mail Platform — Production Readiness Report

**Date:** 2026-07-26  
**Commit series:** through local `f5406e4` + multi-domain auto-provision hardening (this commit)  
**Push:** withheld until VPS agent deploy + full e2e pass

---

## 1. Files changed (this session)

| File | Change |
|------|--------|
| `deploy/vps/mail-agent.sh` | Real **OpenDKIM `dkim.sync`**, **mailbox.quota**, special folders, **`platform.ensure`** (PHP/Nginx/Postfix sizes + HELO), doveadm `auth succeeded` matcher |
| `services/provisioning/mail-engine.ts` | `platform.ensure` command; critical agent commands do not soft-succeed via SQL |
| `services/provisioning/mail-provisioning-service.ts` | Call `platform.ensure` on domain create; apply quota after mailbox create; DKIM must succeed |
| `roundcube/config/attachments-mime.inc.php` | 25M / MIME (prior) |
| `deploy/vps/harden-mail-delivery.sh` | Ops fallback (prior) |
| `lib/dns/records.ts` | SPF includes `ip4:` (prior) |
| `docs/PRODUCTION_MAIL_DELIVERY_REPORT.md` | Delivery audit (prior) |

---

## 2. Bugs fixed

1. **DKIM sync was a stub** — Admin stored keys in Postgres/DNS blueprints but never installed OpenDKIM → unsigned outbound → inconsistent Gmail/Outlook/Yahoo.
2. **Mailbox quota was a no-op** — Orbit quotas never reached Dovecot/MariaDB.
3. **Special folders** — only Maildir dirs; now also `doveadm mailbox create/subscribe` + `subscriptions`.
4. **Attachment 8M ceiling** — `platform.ensure` raises PHP/Nginx/Postfix limits automatically on domain create / health.check.
5. **doveadm “auth succeeded”** — agent now accepts modern Dovecot wording (Node already fixed).
6. **HELO/PTR** — `platform.ensure` sets Postfix `myhostname`/`smtp_helo_name` from PTR.

---

## 3. Security improvements

- DKIM signing keys are Orbit-generated PEM only (no divergent second keygen on VPS for provisioned domains).
- Postfix milters auto-wired to OpenDKIM (`inet:localhost:8891`) when missing.
- Soft-bounce remains off; bounce notify classes retained in harden path.
- Fail-closed: `dkim.sync` / `platform.ensure` failures are not masked by SQL stubs.

---

## 4. Mail improvements (Zoho/Workspace path)

| Capability | Auto from Orbit Admin? |
|------------|-------------------------|
| Unlimited domains (MariaDB `virtual_domains`) | Yes |
| Mailbox + SHA512-CRYPT + doveadm proof | Yes |
| OpenDKIM per domain | Yes (`dkim.sync`) — requires OpenDKIM package once on host |
| Platform size limits (25M) | Yes (`platform.ensure`) |
| Quota | Yes (`mailbox.quota`) |
| Special folders | Yes |
| Customer DNS publish (registrar) | Customer action (Copy DNS in Admin) — not VPS |
| PTR at IP provider | One-time provider setting |

---

## 5. Performance improvements

- Idempotent `platform.ensure` avoids repeated manual harden scripts.
- Quota applied in-band with mailbox create (no extra admin click).
- Health check re-applies platform ensure (self-healing sizes/HELO).

---

## 6. Remaining issues (block full commercial “100”)

| Issue | Owner |
|-------|--------|
| **Deploy updated `mail-agent.sh` to `/opt/global-orbit/bin/`** + `pm2 restart` | Ops (no SSH from this workstation) |
| **OpenDKIM package** must exist once (`apt install opendkim opendkim-tools`) | One-time host bootstrap |
| **Publish DNS** MX/SPF/DKIM/DMARC at registrar for each domain | Customer / Admin DNS UI |
| **PTR** alignment with chosen HELO hostname | IP provider |
| External Gmail/Outlook/Yahoo/Proton/iCloud matrix | Re-test after agent deploy + DKIM DNS |
| Large attachment e2e | Re-test after `platform.ensure` raises PHP past 8M |

---

## 7. Production score: **78 / 100**

Control plane + auth + plain send/receive are strong. Delivery reputation (DKIM live + PTR) and attachment limits depend on deploying the new agent.

## 8. Commercial readiness (unlimited domains): **72 / 100**

Product path now provisions domain → MariaDB → DKIM → platform sizes → mailbox → quota → folders. Still needs: one-time OpenDKIM install, agent binary update, customer DNS publish. Not yet “zero human forever” until those are in your golden image AMI/ansible.

## 9. Ready to host unlimited customer domains?

**Conditionally yes** — after:

```bash
# On mail VPS (once)
apt-get install -y opendkim opendkim-tools
install -m 755 deploy/vps/mail-agent.sh /opt/global-orbit/bin/mail-agent.sh
# ensure MAIL_PROVISION_MODE=local and MAIL_MYSQL_* on Orbit app
pm2 restart all

# Then from Orbit Admin: add domain → copy DNS (incl. orbit._domainkey) → add mailbox
```

Until the agent binary on the VPS is updated, Admin still hits the old stub DKIM path.

---

## Self-test plan (post-deploy)

```bash
ADMIN_PASSWORD=… npx tsx scripts/e2e-admin-mail-flow.ts
RC_USER=… RC_PASS=… node scripts/debug-roundcube-send.mjs
RC_USER=… RC_PASS=… node scripts/e2e-roundcube-attachments.mjs
bash deploy/vps/audit-mail-delivery.sh zenspanp.com
```

Send to Gmail / Outlook / Yahoo / Proton / iCloud; reply and forward; confirm DKIM=pass in headers.
