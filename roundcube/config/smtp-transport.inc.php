<?php
/**
 * GLOBAL ORBIT MAIL — Roundcube 1.6 SMTP transport (production)
 *
 * DECISION (verified against production evidence)
 * ----------------------------------------------
 * Use:  ssl://127.0.0.1:465   (SMTPS / implicit TLS)
 *
 * Why not plain 127.0.0.1:587?
 *   Roundcube calls Net_SMTP::auth(..., $tls=false). Without a tls:// config
 *   token it never STARTTLSes → AUTH missing → "does not support authentication".
 *
 * Why not PHP stream tls://127.0.0.1:587?
 *   PHP tls:// = implicit TLS from byte 0 → "wrong version number" on :587.
 *
 * Why not Roundcube config token tls://127.0.0.1:587?
 *   That token IS valid STARTTLS in Roundcube 1.6 (scheme is stripped; Net_SMTP
 *   starttls() runs). Prefer ssl://:465 instead to mirror OpenSSL SMTPS and
 *   avoid operators confusing it with PHP stream tls://.
 *
 * Production checks (already green):
 *   openssl s_client -starttls smtp -connect 127.0.0.1:587
 *   openssl s_client -connect 127.0.0.1:465
 *   valid certificate, healthy Postfix/Dovecot, IMAP OK
 *
 * Do NOT modify Postfix / Dovecot / IMAP for this file.
 */

$config['smtp_host'] = 'ssl://127.0.0.1:465';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['smtp_auth_type'] = 'PLAIN';

// Loopback SMTPS: cert is for mail.globalorbitmail.cloud, not 127.0.0.1.
// Disable peer name verify on loopback so PHP does not abort connect()
// with an empty "Connection to server failed" (common with verify_peer_name).
$config['smtp_conn_options'] = [
  'ssl' => [
    'verify_peer'       => false,
    'verify_peer_name'  => false,
    'peer_name'         => 'mail.globalorbitmail.cloud',
    'allow_self_signed' => false,
  ],
];

// STARTTLS alternative (Roundcube config token — NOT PHP stream tls://):
// $config['smtp_host'] = 'tls://127.0.0.1:587';

// Temporary diagnostics:
// $config['smtp_debug'] = true;
// $config['smtp_log'] = true;
