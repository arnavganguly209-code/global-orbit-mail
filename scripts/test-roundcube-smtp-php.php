<?php
/**
 * Run ON the mail VPS (PHP CLI). Proves correct SMTP modes for Roundcube.
 *
 * Usage:
 *   php scripts/test-roundcube-smtp-php.php
 *   SMTP_TEST_USER=user@domain SMTP_TEST_PASS='secret' php scripts/test-roundcube-smtp-php.php
 *
 * Does not modify Postfix/Dovecot.
 */

declare(strict_types=1);

$peer = getenv('SMTP_PEER_NAME') ?: 'mail.globalorbitmail.cloud';
$user = getenv('SMTP_TEST_USER') ?: '';
$pass = getenv('SMTP_TEST_PASS') ?: '';

$sslOpts = [
  'ssl' => [
    'verify_peer' => false,
    'verify_peer_name' => false,
    'peer_name' => $peer,
    'allow_self_signed' => true,
  ],
];

function read_smtp($fp): string
{
  $out = '';
  while (!feof($fp)) {
    $line = fgets($fp, 8192);
    if ($line === false) {
      break;
    }
    $out .= $line;
    if (isset($line[3]) && $line[3] === ' ') {
      break;
    }
  }
  return $out;
}

function write_smtp($fp, string $cmd): void
{
  fwrite($fp, $cmd . "\r\n");
}

function ehlo_caps(string $resp): array
{
  $caps = [];
  foreach (preg_split("/\r\n|\n|\r/", trim($resp)) as $line) {
    if (preg_match('/^\d{3}[-\s](.+)$/', $line, $m)) {
      $caps[] = trim($m[1]);
    }
  }
  return $caps;
}

$results = [];

echo "=== 1) PHP implicit tls:// on :587 (EXPECTED FAIL — wrong version number) ===\n";
$errno = 0;
$errstr = '';
$fp = @stream_socket_client(
  'tls://127.0.0.1:587',
  $errno,
  $errstr,
  8,
  STREAM_CLIENT_CONNECT,
  stream_context_create($sslOpts)
);
if ($fp) {
  echo "UNEXPECTED SUCCESS (should fail on STARTTLS port)\n";
  fclose($fp);
  $results['php_tls_587'] = false;
} else {
  echo "FAIL as expected: [$errno] $errstr\n";
  $results['php_tls_587'] = (stripos($errstr, 'wrong version') !== false) || $errno !== 0;
}

echo "\n=== 2) Cleartext TCP :587 + STARTTLS via stream_socket_enable_crypto (OpenSSL-equivalent) ===\n";
$fp = @stream_socket_client('tcp://127.0.0.1:587', $errno, $errstr, 8);
if (!$fp) {
  echo "CONNECT FAIL: [$errno] $errstr\n";
  $results['starttls_587'] = false;
} else {
  stream_set_timeout($fp, 8);
  echo read_smtp($fp);
  write_smtp($fp, 'EHLO roundcube-test.local');
  $caps1 = ehlo_caps(read_smtp($fp));
  echo "PRE-TLS caps: " . implode(' | ', $caps1) . "\n";
  write_smtp($fp, 'STARTTLS');
  echo read_smtp($fp);
  $ok = @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
  if (!$ok) {
    echo "STARTTLS crypto FAIL\n";
    $results['starttls_587'] = false;
    fclose($fp);
  } else {
    write_smtp($fp, 'EHLO roundcube-test.local');
    $caps2 = ehlo_caps(read_smtp($fp));
    echo "POST-TLS caps: " . implode(' | ', $caps2) . "\n";
    $hasAuth = (bool) preg_grep('/^AUTH\b/i', $caps2);
    echo $hasAuth ? "AUTH present after STARTTLS\n" : "AUTH missing after STARTTLS\n";
    $results['starttls_587'] = $hasAuth;
    write_smtp($fp, 'QUIT');
    fclose($fp);
  }
}

echo "\n=== 3) PHP ssl:// on :465 (Roundcube smtp_host mode) ===\n";
$fp = @stream_socket_client(
  'ssl://127.0.0.1:465',
  $errno,
  $errstr,
  8,
  STREAM_CLIENT_CONNECT,
  stream_context_create($sslOpts)
);
if (!$fp) {
  echo "CONNECT FAIL: [$errno] $errstr\n";
  $results['ssl_465'] = false;
} else {
  stream_set_timeout($fp, 8);
  echo read_smtp($fp);
  write_smtp($fp, 'EHLO roundcube-test.local');
  $caps = ehlo_caps(read_smtp($fp));
  echo "SMTPS caps: " . implode(' | ', $caps) . "\n";
  $hasAuth = (bool) preg_grep('/^AUTH\b/i', $caps);
  echo $hasAuth ? "AUTH present on ssl://:465\n" : "AUTH missing on ssl://:465\n";
  $results['ssl_465'] = $hasAuth;

  if ($hasAuth && $user !== '' && $pass !== '') {
    $plain = base64_encode("\0{$user}\0{$pass}");
    write_smtp($fp, "AUTH PLAIN {$plain}");
    $authResp = read_smtp($fp);
    echo "AUTH PLAIN: $authResp";
    $authOk = str_starts_with(trim($authResp), '235');
    $results['ssl_465_auth'] = $authOk;
    if ($authOk) {
      write_smtp($fp, "MAIL FROM:<{$user}>");
      echo read_smtp($fp);
      write_smtp($fp, "RCPT TO:<{$user}>");
      echo read_smtp($fp);
      write_smtp($fp, 'DATA');
      echo read_smtp($fp);
      $body = "Subject: Orbit SMTP transport test\r\nFrom: {$user}\r\nTo: {$user}\r\n\r\nRoundcube ssl://:465 path OK\r\n.\r\n";
      fwrite($fp, $body);
      $dataResp = read_smtp($fp);
      echo "DATA: $dataResp";
      $results['ssl_465_send'] = str_starts_with(trim($dataResp), '250');
    }
  } else {
    echo "(Set SMTP_TEST_USER / SMTP_TEST_PASS to AUTH + send a test message)\n";
  }

  write_smtp($fp, 'QUIT');
  @fclose($fp);
}

echo "\n=== SUMMARY ===\n";
foreach ($results as $k => $v) {
  echo ($v ? 'PASS' : 'FAIL') . "  $k\n";
}

$required = ['php_tls_587', 'ssl_465'];
$ok = true;
foreach ($required as $k) {
  if (empty($results[$k])) {
    $ok = false;
  }
}
// starttls_587 is informational / OpenSSL-parity; ssl_465 is the Roundcube config path
exit($ok ? 0 : 1);
