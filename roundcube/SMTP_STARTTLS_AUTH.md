# Roundcube SMTP — production decision

## Choice

**Use `ssl://127.0.0.1:465`** (SMTPS / implicit TLS).

| Option | Verdict |
|--------|---------|
| `ssl://127.0.0.1:465` | **Selected** — matches OpenSSL SMTPS; Net_SMTP uses real `ssl://` streams |
| Roundcube `tls://127.0.0.1:587` | Valid STARTTLS *config token* (scheme stripped, then `starttls()`). Do not confuse with PHP `stream_socket_client('tls://…:587')` |
| Plain `127.0.0.1:587` | **Broken** — Roundcube never STARTTLSes (`auth(..., false)`) |
| PHP `tls://127.0.0.1:587` | **Broken** — implicit TLS on STARTTLS port → wrong version number |

## Live symptom after login works

`SMTP Error (): Connection to server failed.`

Usually: snippet not applied yet, or PHP peer verify aborting loopback SMTPS.
`smtp-transport.inc.php` disables peer verify on loopback and sets `peer_name`.

## Apply on VPS (required)

```bash
curl -fsSL https://raw.githubusercontent.com/arnavganguly209-code/global-orbit-mail/main/deploy/vps/apply-roundcube-smtp-inline.sh | bash
```

Or from repo: `bash deploy/vps/apply-roundcube-smtp-inline.sh`

Then send from Roundcube and re-run:

```bash
RC_USER=… RC_PASS=… node scripts/debug-roundcube-send.mjs
```

Do not change Postfix / Dovecot / IMAP.
