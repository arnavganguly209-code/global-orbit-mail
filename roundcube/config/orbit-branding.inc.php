<?php
/**
 * GLOBAL ORBIT MAIL — Roundcube branding config snippet
 *
 * Merge these keys into the LIVE Roundcube config file, typically:
 *   /path/to/roundcube/config/config.inc.php
 *
 * Do NOT replace IMAP / SMTP / database / session settings.
 * Only apply skin + product branding keys below.
 */

// Product branding (browser title / UI product name)
$config['product_name'] = 'Global Orbit Mail';

// Use the custom Orbit skin (extends Elastic — update-safe isolation)
$config['skin'] = 'orbit';

// Optional: force logo assets from the orbit skin
$config['skin_logo'] = [
  'login[elastic]*' => '/images/logo.png',
  'login[orbit]*'   => '/images/logo.png',
  '*[orbit]*'       => '/images/logo.png',
  '*[elastic]*'     => '/images/logo.png',
];

// Support / forgot-password destination
$config['support_url'] = 'https://theglobalorbit.com';

// Hide default Roundcube product/version footer (custom footer is in login template)
$config['display_product_info'] = 0;

// Keep Elastic dark-mode capability available in Orbit skin
$config['skin_include_php'] = false;
