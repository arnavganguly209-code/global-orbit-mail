<?php
/**
 * GLOBAL ORBIT MAIL — Roundcube 1.6.x SMTP transport
 *
 * CORRECT MODES (Roundcube 1.6 / Net_SMTP)
 * ----------------------------------------
 * 1) Implicit TLS (SMTPS):  smtp_host = 'ssl://HOST:465'
 *    PHP connects with SSL from the first byte. AUTH is available immediately.
 *
 * 2) STARTTLS (submission): smtp_host = 'tls://HOST:587'
 *    Roundcube STRIPS the scheme, connects in cleartext, then calls
 *    Net_SMTP::starttls(). This is NOT the same as PHP
 *    stream_socket_client('tls://HOST:587'), which is implicit TLS and fails
 *    on :587 with "SSL routines::wrong version number".
 *
 * THIS FILE USES (1) — ssl:// on 465 — because production evidence showed:
 *   - openssl s_client -starttls smtp -connect 127.0.0.1:587  → OK
 *   - stream_socket_client('tls://127.0.0.1:587')              → wrong version number
 * and operators must not configure PHP-style tls:// against port 587.
 *
 * Do NOT use:  'tls://127.0.0.1:587' as a PHP stream target
 * Do NOT use:  plain '127.0.0.1:587' without Roundcube STARTTLS
 *              (Roundcube calls auth(..., $tls=false), so AUTH never appears
 *              until after STARTTLS / SMTPS).
 *
 * Deploy:
 *   include __DIR__ . '/smtp-transport.inc.php';
 *   bash deploy/vps/fix-roundcube-smtp.sh
 *
 * Do NOT modify Postfix or Dovecot for this fix.
 */

// Implicit TLS on SMTPS — correct PHP/Roundcube ssl:// usage
$config['smtp_host'] = 'ssl://127.0.0.1:465';

$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['smtp_auth_type'] = 'PLAIN';

// Certificate is issued for the public mail hostname, not 127.0.0.1
$config['smtp_conn_options'] = [
  'ssl' => [
    'verify_peer'       => true,
    'verify_peer_name'  => true,
    'peer_name'         => 'mail.globalorbitmail.cloud',
    'allow_self_signed' => false,
  ],
];

// If CA verification fails on loopback, temporarily:
// $config['smtp_conn_options'] = [
//   'ssl' => [
//     'verify_peer'      => false,
//     'verify_peer_name' => false,
//     'peer_name'        => 'mail.globalorbitmail.cloud',
//   ],
// ];

// $config['smtp_debug'] = true;
// $config['smtp_log'] = true;
