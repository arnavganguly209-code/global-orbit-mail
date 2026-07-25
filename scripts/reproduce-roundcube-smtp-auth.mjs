/**
 * Reproduce Roundcube 1.6.x "SMTP server does not support authentication"
 *
 * Root cause (confirmed by capability dump matching production):
 *   Roundcube 1.6 only calls Net_SMTP::starttls() when smtp_host uses tls://.
 *   Without tls://, it EHLO's in cleartext on :587. Postfix submission
 *   advertises STARTTLS but NOT AUTH until after STARTTLS — exactly the
 *   capability list Roundcube logs.
 *
 * Manual OpenSSL sees AUTH because it completes STARTTLS then re-EHLO.
 * Roundcube without tls:// never does that, so AUTH "disappears".
 *
 * Usage: node scripts/reproduce-roundcube-smtp-auth.mjs
 */

import net from "node:net";

const PORT = 2587;

/** Mimic Roundcube rcube_utils::parse_host_uri for smtp_host */
function parseHostUri(smtpHost, defaultPort = 587, sslPort = 465) {
  const m = String(smtpHost).match(/^(ssl|tls):\/\/(.+)$/i);
  if (m) {
    const scheme = m[1].toLowerCase();
    let rest = m[2];
    let port = scheme === "ssl" ? sslPort : defaultPort;
    const hostPort = rest.match(/^(.+):(\d+)$/);
    if (hostPort) {
      rest = hostPort[1];
      port = Number(hostPort[2]);
    }
    return { host: rest, scheme, port, useTls: scheme === "tls", useSsl: scheme === "ssl" };
  }
  let host = smtpHost;
  let port = defaultPort;
  const hostPort = String(smtpHost).match(/^(.+):(\d+)$/);
  if (hostPort) {
    host = hostPort[1];
    port = Number(hostPort[2]);
  }
  return { host, scheme: "", port, useTls: false, useSsl: false };
}

function cleartextCaps() {
  // Exact shape of production Roundcube log (pre-TLS submission EHLO)
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

function tlsCaps() {
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

function startMockServer() {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let upgraded = false;
      let buffer = "";

      writeLines(socket, ["220 mock-postfix ESMTP ready"]);

      const onData = (chunk) => {
        buffer += chunk.toString("utf8");
        let idx;
        while ((idx = buffer.indexOf("\r\n")) >= 0) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          handle(line);
        }
      };

      const handle = (line) => {
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          writeLines(socket, upgraded ? tlsCaps() : cleartextCaps());
          return;
        }
        if (upper === "STARTTLS") {
          writeLines(socket, ["220 2.0.0 Ready to start TLS"]);
          // Mark logical upgrade even without crypto so client repro works offline
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

      socket.on("data", onData);
    });

    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function smtpSession(smtpHostConfig) {
  const parsed = parseHostUri(smtpHostConfig, 2587, 465);
  // Force our mock port
  parsed.port = PORT;

  const sock = await new Promise((resolve, reject) => {
    const s = net.connect({ host: "127.0.0.1", port: PORT }, () => resolve(s));
    s.on("error", reject);
  });

  const read = () =>
    new Promise((resolve) => {
      let data = "";
      const onData = (chunk) => {
        data += chunk.toString("utf8");
        // Wait until a final line (code + space) or enough lines
        if (/\r\n\d{3} /.test(data) || (data.split("\r\n").filter(Boolean).length > 1 && !sock.readableLength)) {
          // for multi-line 250-...250 ... drain briefly
        }
        clearTimeout(timer);
        timer = setTimeout(() => {
          sock.off("data", onData);
          resolve(data);
        }, 50);
      };
      let timer = setTimeout(() => {
        sock.off("data", onData);
        resolve(data);
      }, 300);
      sock.on("data", onData);
    });

  const write = (cmd) => {
    sock.write(cmd + "\r\n");
  };

  const banner = await read();
  write("EHLO roundcube-repro.local");
  const ehlo1 = await read();
  const caps1 = ehlo1
    .split(/\r?\n/)
    .map((l) => l.replace(/^\d{3}[- ]/, "").trim())
    .filter(Boolean);

  // Roundcube 1.6 behavior: starttls ONLY if scheme === 'tls'
  let capsFinal = caps1;
  let didStartTls = false;
  if (parsed.useTls) {
    write("STARTTLS");
    await read();
    didStartTls = true;
    write("EHLO roundcube-repro.local");
    const ehlo2 = await read();
    capsFinal = ehlo2
      .split(/\r?\n/)
      .map((l) => l.replace(/^\d{3}[- ]/, "").trim())
      .filter(Boolean);
  }

  const hasAuth = capsFinal.some((c) => /^AUTH\b/i.test(c) || /^AUTH=/i.test(c));
  const hasStartTls = capsFinal.some((c) => /STARTTLS/i.test(c));

  let authOk = false;
  let authMsg = "skipped";
  if (hasAuth) {
    write("AUTH PLAIN AHRlc3QAdGVzdA==");
    const authResp = await read();
    authOk = /235/.test(authResp);
    authMsg = authResp.trim();
  } else {
    authMsg = "SMTP server does not support authentication";
  }

  write("QUIT");
  sock.end();

  return {
    config: smtpHostConfig,
    parsed,
    didStartTls,
    capsFinal,
    hasAuth,
    hasStartTls,
    authOk,
    authMsg,
  };
}

function printResult(label, r) {
  console.log(`\n=== ${label} ===`);
  console.log(`smtp_host          : ${r.config}`);
  console.log(`parsed.useTls      : ${r.parsed.useTls}`);
  console.log(`did STARTTLS       : ${r.didStartTls}`);
  console.log(`caps after connect :`);
  for (const c of r.capsFinal) console.log(`  ${c}`);
  console.log(`has AUTH           : ${r.hasAuth}`);
  console.log(`still has STARTTLS : ${r.hasStartTls}`);
  console.log(`auth result        : ${r.authOk ? "OK" : "FAIL"} — ${r.authMsg}`);
}

const server = await startMockServer();
try {
  // BUG path — Roundcube default / misconfig (missing tls://)
  const buggy = await smtpSession("127.0.0.1:2587");
  printResult("BUG: smtp_host WITHOUT tls:// (Roundcube production failure)", buggy);

  // FIX path
  const fixed = await smtpSession("tls://127.0.0.1:2587");
  printResult("FIX: smtp_host WITH tls:// (Roundcube 1.6 correct)", fixed);

  const pass =
    !buggy.hasAuth &&
    buggy.hasStartTls &&
    buggy.authMsg.includes("does not support authentication") &&
    fixed.hasAuth &&
    !fixed.hasStartTls &&
    fixed.authOk;

  console.log("\n=== VERDICT ===");
  if (pass) {
    console.log(
      "PASS — Missing tls:// leaves Roundcube on cleartext EHLO (STARTTLS present, AUTH absent).",
    );
    console.log("      Adding tls:// triggers STARTTLS + re-EHLO; AUTH appears (matches OpenSSL).");
    process.exitCode = 0;
  } else {
    console.log("FAIL — unexpected capability/auth results");
    process.exitCode = 1;
  }
} finally {
  server.close();
}
