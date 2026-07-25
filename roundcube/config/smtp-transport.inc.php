<?php
/**
 * GLOBAL ORBIT MAIL — Roundcube 1.6.x SMTP transport (submission + STARTTLS)
 *
 * WHY THIS EXISTS
 * ---------------
 * Roundcube 1.6 only calls Net_SMTP::starttls() when smtp_host uses the tls://
 * scheme (see program/lib/Roundcube/rcube_smtp.php → parse_host_uri).
 *
 * Postfix on port 587 advertises AUTH *only after* STARTTLS. Cleartext EHLO
 * returns STARTTLS + PIPELINING + … but NOT AUTH. That is exactly the capability
 * dump Roundcube logs as "SMTP server does not support authentication".
 *
 * OpenSSL s_client -starttls smtp sees AUTH because it completes STARTTLS and
 * re-EHLO. Roundcube without tls:// never does — AUTH appears to "disappear".
 *
 * Deploy: merge into /var/www/roundcube/config/config.inc.php
 *   include __DIR__ . '/smtp-transport.inc.php';
 *
 * Or run: bash deploy/vps/fix-roundcube-smtp.sh
 *
 * Do NOT set obsolete smtp_server / smtp_port (removed in 1.6).
 */

// Submission + explicit STARTTLS (required for AUTH on modern Postfix)
// Prefer loopback when Roundcube is co-located with Postfix.
$config['smtp_host'] = 'tls://127.0.0.1:587';

// Authenticate as the logged-in mailbox user
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['smtp_auth_type'] = 'PLAIN';

// TLS to 127.0.0.1 will not match the public cert CN/SAN by default.
// peer_name must be the hostname on the Postfix TLS certificate.
$config['smtp_conn_options'] = [
  'ssl' => [
    'verify_peer'       => true,
    'verify_peer_name'  => true,
    'peer_name'         => 'mail.globalorbitmail.cloud',
    'allow_self_signed' => false,
  ],
];

// If peer verify still fails (wrong CA bundle / incomplete chain), temporarily use:
// $config['smtp_conn_options'] = [
//   'ssl' => [
//     'verify_peer'      => false,
//     'verify_peer_name' => false,
//     'peer_name'        => 'mail.globalorbitmail.cloud',
//   ],
// ];

// Optional diagnostics (disable after fix verified)
// $config['smtp_debug'] = true;
// $config['smtp_log'] = true;
