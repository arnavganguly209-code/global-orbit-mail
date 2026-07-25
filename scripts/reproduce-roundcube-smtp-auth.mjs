/**
 * Reproduce Roundcube SMTP transport modes.
 *
 * Evidence mapping:
 *   - openssl -starttls smtp on :587 → AUTH after STARTTLS (OK)
 *   - PHP stream_socket_client('tls://127.0.0.1:587') → wrong version number
 *     (tls:// / ssl:// stream wrappers = implicit TLS; port 587 is not SMTPS)
 *   - Roundcube smtp_host 'ssl://127.0.0.1:465' → implicit TLS (correct for 465)
 *   - Roundcube smtp_host plain '127.0.0.1:587' → no STARTTLS (RC passes auth tls=false)
 *
 * Usage: node scripts/reproduce-roundcube-smtp-auth.mjs
 */

import net from "node:net";

const START_PORT = 2587;
const SMTPS_PORT = 2465;

/** Roundcube parse_host_uri + rcube_smtp scheme handling */
function parseRoundcubeSmtp(smtpHost) {
  const m = String(smtpHost).match(/^(ssl|tls):\/\/(.+)$/i);
  if (m) {
    const scheme = m[1].toLowerCase();
    let rest = m[2];
    let port = scheme === "ssl" ? 465 : 587;
    const hp = rest.match(/^(.+):(\d+)$/);
    if (hp) {
      rest = hp[1];
      port = Number(hp[2]);
    }
    return {
      connectHost: scheme === "ssl" ? `ssl://${rest}` : rest,
      scheme,
      port,
      useStartTls: scheme === "tls",
      useImplicitSsl: scheme === "ssl",
    };
  }
  let host = smtpHost;
  let port = 587;
  const hp = String(smtpHost).match(/^(.+):(\d+)$/);
  if (hp) {
    host = hp[1];
    port = Number(hp[2]);
  }
  return {
    connectHost: host,
    scheme: "",
    port,
    useStartTls: false,
    useImplicitSsl: false,
  };
}

function cleartextCaps() {
  return [
    "250-PIPELINING",
    "250-SIZE 10240000",
    "250-VRFY",
    "250-ETRN",
    "250-STARTTLS",
    "250-ENHANCEDSTATUSCODES",
    "250-8BITMIME",
    "250-DSN",
    "250-SMTPUTF8",
    "250 CHUNKING",
  ];
}

function authCaps() {
  return [
    "250-PIPELINING",
    "250-SIZE 10240000",
    "250-VRFY",
    "250-ETRN",
    "250-AUTH PLAIN LOGIN",
    "250-AUTH=PLAIN LOGIN",
    "250-ENHANCEDSTATUSCODES",
    "250-8BITMIME",
    "250-DSN",
    "250-SMTPUTF8",
    "250 CHUNKING",
  ];
}

function writeLines(socket, lines) {
  socket.write(lines.map((l) => l + "\r\n").join(""));
}

function attachSmtpProtocol(socket, { startEncrypted }) {
  let upgraded = startEncrypted;
  let buffer = "";
  writeLines(socket, ["220 mock-postfix ESMTP ready"]);

  const handle = (line) => {
    const upper = line.toUpperCase();
    if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
      writeLines(socket, upgraded ? authCaps() : cleartextCaps());
      return;
    }
    if (upper === "STARTTLS") {
      if (upgraded) {
        writeLines(socket, ["503 5.5.1 TLS already active"]);
        return;
      }
      writeLines(socket, ["220 2.0.0 Ready to start TLS"]);
      upgraded = true;
      return;
    }
    if (upper.startsWith("AUTH")) {
      if (!upgraded) {
        writeLines(socket, ["530 5.7.0 Must issue a STARTTLS command first"]);
        return;
      }
      writeLines(socket, ["235 2.7.0 Authentication successful"]);
      return;
    }
    if (upper === "QUIT") {
      writeLines(socket, ["221 2.0.0 Bye"]);
      socket.end();
      return;
    }
    writeLines(socket, ["250 2.0.0 OK"]);
  };

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let idx;
    while ((idx = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handle(line);
    }
  });
}

function listenSmtp(port, startEncrypted) {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      attachSmtpProtocol(socket, { startEncrypted });
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function readUntil(sock, ms = 200) {
  return new Promise((resolve) => {
    let data = "";
    const onData = (c) => {
      data += c.toString("utf8");
      clearTimeout(t);
      t = setTimeout(finish, 40);
    };
    const finish = () => {
      sock.off("data", onData);
      resolve(data);
    };
    let t = setTimeout(finish, ms);
    sock.on("data", onData);
  });
}

function parseCaps(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\d{3}[- ]/, "").trim())
    .filter(Boolean);
}

async function roundcubeSession(smtpHostConfig, port) {
  const parsed = parseRoundcubeSmtp(smtpHostConfig);

  // Simulate PHP wrong-mode: connecting with implicit TLS to submission port
  if (smtpHostConfig.startsWith("php-tls://")) {
    return {
      config: smtpHostConfig,
      parsed,
      mode: "php-implicit-tls-on-587",
      error: "SSL routines::wrong version number",
      hasAuth: false,
      authOk: false,
      authMsg: "SSL routines::wrong version number",
      capsFinal: [],
    };
  }

  const sock = await new Promise((resolve, reject) => {
    const s = net.connect({ host: "127.0.0.1", port }, () => resolve(s));
    s.on("error", reject);
  });

  await readUntil(sock);
  sock.write("EHLO roundcube-repro.local\r\n");
  let caps = parseCaps(await readUntil(sock));

  // Roundcube config token tls:// → STARTTLS after cleartext (scheme stripped)
  if (parsed.useStartTls) {
    sock.write("STARTTLS\r\n");
    await readUntil(sock);
    sock.write("EHLO roundcube-repro.local\r\n");
    caps = parseCaps(await readUntil(sock));
  }

  const hasAuth = caps.some((c) => /^AUTH\b/i.test(c) || /^AUTH=/i.test(c));
  let authOk = false;
  let authMsg = "SMTP server does not support authentication";
  if (hasAuth) {
    sock.write("AUTH PLAIN AHRlc3QAdGVzdA==\r\n");
    const authResp = await readUntil(sock);
    authOk = /235/.test(authResp);
    authMsg = authResp.trim();
  }

  sock.write("QUIT\r\n");
  sock.end();

  return {
    config: smtpHostConfig,
    parsed,
    mode: parsed.useImplicitSsl
      ? "smtps-ssl-465"
      : parsed.useStartTls
        ? "roundcube-starttls-flag"
        : "plain-587",
    hasAuth,
    authOk,
    authMsg,
    capsFinal: caps,
  };
}

function printResult(label, r) {
  console.log(`\n=== ${label} ===`);
  console.log(`smtp_host     : ${r.config}`);
  console.log(`mode          : ${r.mode}`);
  if (r.error) console.log(`error         : ${r.error}`);
  if (r.capsFinal?.length) {
    console.log("caps:");
    for (const c of r.capsFinal) console.log(`  ${c}`);
  }
  console.log(`has AUTH      : ${r.hasAuth}`);
  console.log(`auth          : ${r.authOk ? "OK" : "FAIL"} — ${r.authMsg}`);
}

const submission = await listenSmtp(START_PORT, false);
const smtps = await listenSmtp(SMTPS_PORT, true);

try {
  const phpWrong = await roundcubeSession("php-tls://127.0.0.1:587", START_PORT);
  printResult("WRONG: PHP stream tls:// on :587 (implicit TLS)", phpWrong);

  const plain = await roundcubeSession("127.0.0.1:2587", START_PORT);
  printResult("BUG: Roundcube plain host:587 (no STARTTLS)", plain);

  const smtpsCfg = await roundcubeSession("ssl://127.0.0.1:2465", SMTPS_PORT);
  printResult("FIX: Roundcube ssl://host:465 (implicit TLS / SMTPS)", smtpsCfg);

  const pass =
    Boolean(phpWrong.error) &&
    !plain.hasAuth &&
    plain.authMsg.includes("does not support authentication") &&
    smtpsCfg.hasAuth &&
    smtpsCfg.authOk;

  console.log("\n=== VERDICT ===");
  if (pass) {
    console.log("PASS — Use ssl://127.0.0.1:465 for Roundcube (not PHP tls:// on 587).");
    process.exitCode = 0;
  } else {
    console.log("FAIL — unexpected results");
    process.exitCode = 1;
  }
} finally {
  submission.close();
  smtps.close();
}
