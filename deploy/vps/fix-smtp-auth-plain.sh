#!/usr/bin/env bash
# GLOBAL ORBIT MAIL — Force SMTP AUTH PLAIN (production evidence fix)
#
# LIVE PROOF (mail.globalorbitmail.cloud):
#   EHLO advertises: 250-AUTH PLAIN   (LOGIN not offered)
#   AUTH PLAIN  → 235 2.7.0 Authentication successful
#   AUTH LOGIN  → 535 5.7.8 Invalid authentication mechanism
#
# Roundcube / Net_SMTP must use PLAIN, never LOGIN, on this host.
#
# Usage (on VPS as root):
#   bash deploy/vps/fix-smtp-auth-plain.sh
#   RC_USER=recaption@zenspanp.com RC_PASS='…' RC_TO=you@gmail.com bash deploy/vps/fix-smtp-auth-plain.sh
#
set -euo pipefail

RC_ROOT="${ORBIT_ROUNDCUBE_ROOT:-/var/www/roundcube}"
CFG="${RC_ROOT}/config/config.inc.php"
SMTP_INC="${RC_ROOT}/config/smtp-transport.inc.php"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=============================================="
echo " FIX SMTP AUTH → PLAIN only (matches Postfix)"
echo "=============================================="

echo
echo "==> [1/8] Live EHLO AUTH advertisement"
python3 - <<'PY'
import ssl, socket
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
for port, starttls in ((465, False), (587, True)):
    try:
        raw = socket.create_connection(("127.0.0.1", port), 10)
        if starttls:
            banner = raw.recv(1024)
            raw.sendall(b"EHLO orbit-probe\r\n")
            caps = raw.recv(4096)
            raw.sendall(b"STARTTLS\r\n")
            raw.recv(1024)
            sock = ctx.wrap_socket(raw, server_hostname="mail.globalorbitmail.cloud")
        else:
            sock = ctx.wrap_socket(raw, server_hostname="mail.globalorbitmail.cloud")
            sock.recv(1024)
        sock.sendall(b"EHLO orbit-probe\r\n")
        data = b""
        while True:
            chunk = sock.recv(4096)
            data += chunk
            if not chunk or (b"\n" in chunk and chunk.split(b"\n")[-2:-1] and not chunk.split(b"\n")[-2].startswith(b"250-")):
                # read until last 250 space line
                if b"250 " in data:
                    break
            if data.count(b"\n") > 40:
                break
        text = data.decode("latin-1", "replace")
        auth_lines = [ln for ln in text.splitlines() if "AUTH" in ln.upper()]
        print(f"port {port}: {auth_lines or ['(no AUTH line)']}")
        sock.sendall(b"QUIT\r\n")
        sock.close()
    except Exception as exc:
        print(f"port {port}: ERROR {exc}")
PY

echo
echo "==> [2/8] Write Roundcube smtp-transport with smtp_auth_type=PLAIN"
mkdir -p "${RC_ROOT}/config"
if [[ -f "${REPO_ROOT}/roundcube/config/smtp-transport.inc.php" ]]; then
  cp -a "${REPO_ROOT}/roundcube/config/smtp-transport.inc.php" "$SMTP_INC"
fi

cat > "$SMTP_INC" <<'PHP'
<?php
/**
 * GLOBAL ORBIT MAIL — Roundcube SMTP (production)
 * Evidence: Postfix advertises AUTH PLAIN only.
 * AUTH LOGIN → 535 Invalid authentication mechanism.
 */
$config['smtp_host'] = 'ssl://127.0.0.1:465';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['smtp_auth_type'] = 'PLAIN';
$config['smtp_timeout'] = 60;
$config['smtp_conn_options'] = [
  'ssl' => [
    'verify_peer' => false,
    'verify_peer_name' => false,
    'peer_name' => 'mail.globalorbitmail.cloud',
    'allow_self_signed' => true,
  ],
];
// Keep debug on until Gmail send verified; then set false
$config['smtp_log'] = true;
$config['smtp_debug'] = true;
PHP

chown www-data:www-data "$SMTP_INC" 2>/dev/null || true
chmod 640 "$SMTP_INC"

if [[ -f "$CFG" ]]; then
  cp -a "$CFG" "${CFG}.bak.authplain.$(date +%Y%m%d%H%M%S)"
  python3 - <<'PY' "$CFG"
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()
for key in ("smtp_server", "smtp_port", "smtp_host", "smtp_user", "smtp_pass", "smtp_auth_type"):
    text = re.sub(
        rf"(?m)^(\s*)(\$config\[['\"]{key}['\"]\]\s*=)",
        rf"\1// ORBIT-SMTP-OVERRIDE — \2",
        text,
    )
needle = "include __DIR__ . '/smtp-transport.inc.php';"
text = text.replace(needle, "")
# strip duplicate includes
text = re.sub(r"(?m)^\s*include\s+__DIR__\s*\.\s*'/smtp-transport\.inc\.php'\s*;\s*$", "", text)
text = text.rstrip() + f"\n\n// GLOBAL ORBIT — SMTP transport LAST (AUTH PLAIN)\n{needle}\n"
open(path, "w", encoding="utf-8").write(text)
print("patched", path)
PY
  php -l "$CFG"
fi
php -l "$SMTP_INC"

echo
echo "==> [3/8] Optionally enable LOGIN in Dovecot too (clients) — keep PLAIN primary"
# Do not break existing PLAIN. Add login if dovecot conf allows.
if [[ -d /etc/dovecot ]]; then
  if grep -Rqs "auth_mechanisms" /etc/dovecot 2>/dev/null; then
    # Best-effort: ensure plain is present; add login if missing
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      if grep -q "auth_mechanisms" "$f"; then
        if ! grep -E "auth_mechanisms.*login" "$f" >/dev/null; then
          sed -i.bak-orbit-auth -E 's/^(auth_mechanisms\s*=\s*.*plain)/\1 login/' "$f" || true
        fi
      fi
    done < <(grep -Rl "auth_mechanisms" /etc/dovecot 2>/dev/null || true)
    systemctl reload dovecot 2>/dev/null || true
  fi
fi

echo
echo "==> [4/8] Ensure milters not hanging; Postfix SASL on"
postconf -e "smtpd_sasl_auth_enable = yes" 2>/dev/null || true
# Keep milters cleared if OpenDKIM down
if ! ss -tlnp 2>/dev/null | grep -q ':8891 '; then
  postconf -e "smtpd_milters ="
  postconf -e "non_smtpd_milters ="
fi
systemctl reload postfix 2>/dev/null || systemctl restart postfix

echo
echo "==> [5/8] PHP-FPM / nginx timeouts + Roundcube cache"
if [[ -d /etc/php ]]; then
  while IFS= read -r conf_dir; do
    [[ -z "$conf_dir" || ! -d "$conf_dir" ]] && continue
    cat > "${conf_dir}/98-orbit-smtp-timeouts.ini" <<'EOF'
max_execution_time = 120
default_socket_timeout = 60
EOF
  done < <(find /etc/php -type d -name conf.d 2>/dev/null)
fi
rm -rf "${RC_ROOT}/temp/cache" "${RC_ROOT}/temp/cache_"* 2>/dev/null || true
systemctl reload php8.3-fpm 2>/dev/null || systemctl reload php8.2-fpm 2>/dev/null || systemctl reload php8.1-fpm 2>/dev/null || true
systemctl reload nginx 2>/dev/null || true

echo
echo "==> [6/8] AUTH PLAIN proof on 465"
php -r '
$ctx = stream_context_create(["ssl"=>["verify_peer"=>false,"verify_peer_name"=>false,"allow_self_signed"=>true,"peer_name"=>"mail.globalorbitmail.cloud"]]);
$fp = stream_socket_client("ssl://127.0.0.1:465", $e, $s, 15, STREAM_CLIENT_CONNECT, $ctx);
if (!$fp) { fwrite(STDERR, "connect fail $s\n"); exit(1); }
function rd($fp){ $o=""; while(!feof($fp)){ $l=fgets($fp); $o.=$l; if(isset($l[3])&&$l[3]===" ") break;} return $o; }
echo rd($fp);
fwrite($fp, "EHLO orbit-plain\r\n"); echo rd($fp);
fwrite($fp, "QUIT\r\n"); rd($fp); fclose($fp);
echo "EHLO probe done\n";
'

echo
echo "==> [7/8] Authenticated PLAIN send (if RC_USER/RC_PASS set)"
if [[ -n "${RC_USER:-}" && -n "${RC_PASS:-}" ]]; then
  export RC_USER RC_PASS
  export RC_TO="${RC_TO:-${RC_USER}}"
  php -r '
$user=getenv("RC_USER"); $pass=getenv("RC_PASS"); $to=getenv("RC_TO")?:$user;
$ctx=stream_context_create(["ssl"=>["verify_peer"=>false,"verify_peer_name"=>false,"allow_self_signed"=>true,"peer_name"=>"mail.globalorbitmail.cloud"]]);
$fp=stream_socket_client("ssl://127.0.0.1:465",$e,$s,20,STREAM_CLIENT_CONNECT,$ctx);
if(!$fp){fwrite(STDERR,"connect fail\n"); exit(1);}
function expect($fp,$code){$line=fgets($fp); echo $line; if(strpos($line,(string)$code)!==0){fwrite(STDERR,"want $code\n"); exit(1);} while(isset($line[3])&&$line[3]==="-"){$line=fgets($fp); echo $line;}}
function cmd($fp,$c,$code){fwrite($fp,$c."\r\n"); expect($fp,$code);}
expect($fp,220);
cmd($fp,"EHLO orbit-auth-plain",250);
// AUTH PLAIN: base64("\0user\0pass")
$plain=base64_encode("\0".$user."\0".$pass);
cmd($fp,"AUTH PLAIN ".$plain,235);
cmd($fp,"MAIL FROM:<{$user}>",250);
cmd($fp,"RCPT TO:<{$to}>",250);
cmd($fp,"DATA",354);
$msg="Subject: Orbit AUTH PLAIN fix ".date("c")."\r\nFrom: {$user}\r\nTo: {$to}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nDate: ".date("r")."\r\nMessage-ID: <orbit-plain-".time()."@local>\r\n\r\nOrbit SMTP AUTH PLAIN OK\r\n.\r\n";
fwrite($fp,$msg); expect($fp,250);
cmd($fp,"QUIT",221);
echo "PASS: AUTH PLAIN + send accepted\n";
'
else
  echo "    Skipped AUTH send (set RC_USER RC_PASS)"
fi

echo
echo "==> [8/8] Roundcube config grep"
grep -n "smtp_auth_type\|smtp_host\|smtp-transport" "$SMTP_INC" "$CFG" 2>/dev/null | head -n 40 || true

cat <<EOF

DONE. Roundcube smtp_auth_type=PLAIN forced.

UI proof:
  https://webmail.globalorbitmail.cloud → Compose → Gmail
  Expect: no 535 / no Failed to reach the server

If still failing: tail -100 ${RC_ROOT}/logs/smtp ${RC_ROOT}/logs/errors.log /var/log/mail.log
EOF
