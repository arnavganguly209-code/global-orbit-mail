<?php
/**
 * GLOBAL ORBIT MAIL — Roundcube attachments + MIME (Workspace-class limits)
 *
 * Merge into live Roundcube:
 *   include __DIR__ . '/attachments-mime.inc.php';
 *
 * Companion VPS script: deploy/vps/harden-mail-delivery.sh
 * (PHP upload_*, Nginx client_max_body_size, Postfix message_size_limit)
 */

// 25 MiB message budget (matches Postfix message_size_limit in harden script)
$config['max_message_size'] = '25M';

// Keep uploads under Roundcube temp (must be www-data writable)
$config['temp_dir'] = 'temp/';

// Prefer 8-bit MIME when remote SMTP advertises 8BITMIME (Gmail/Outlook OK)
$config['smtp_conn_options'] = array_replace_recursive(
  is_array($config['smtp_conn_options'] ?? null) ? $config['smtp_conn_options'] : [],
  [
    'ssl' => [
      'verify_peer' => false,
      'verify_peer_name' => false,
      'peer_name' => 'mail.globalorbitmail.cloud',
    ],
  ],
);

// Do not force broken 7bit conversion that corrupts binaries
$config['force_7bit'] = false;

// Allow common attachment types (Roundcube uses system mime.types when empty)
$config['mime_types'] = null;

// HELO must match reverse DNS (PTR). Live PTR is mail.theglobalorbit.com.
// Postfix smtp_helo_name is authoritative for outbound; keep Roundcube aligned.
$config['smtp_helo_host'] = getenv('ORBIT_SMTP_HELO') ?: 'mail.theglobalorbit.com';

// Attachment UI / compose
$config['compose_save_localstorage'] = true;

// Logging for attachment/SMTP failures (disable after verification)
// $config['smtp_debug'] = true;
// $config['smtp_log'] = true;
