<?php
/**
 * GLOBAL ORBIT MAIL — Roundcube branding (production)
 *
 * Include from live config.inc.php:
 *   include __DIR__ . '/orbit-branding.inc.php';
 *
 * Do NOT change IMAP / SMTP / database / session settings here.
 */

$config['product_name'] = 'Global Orbit Mail';
$config['skin'] = 'orbit';
$config['skin_logo'] = [
  '*' => '/images/logo.png',
  'login*' => '/images/logo.png',
  '*[dark]' => '/images/logo-dark.png',
  'print*' => '/images/logo.png',
];
$config['support_url'] = 'https://theglobalorbit.com';
$config['display_product_info'] = 0;
// Remove Roundcube vendor watermark / about links where supported
$config['dont_override'] = array_values(array_unique(array_merge(
  isset($config['dont_override']) && is_array($config['dont_override']) ? $config['dont_override'] : [],
  ['skin', 'product_name']
)));
