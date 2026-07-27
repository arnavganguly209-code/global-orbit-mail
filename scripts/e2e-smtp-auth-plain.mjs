/**
 * Production SMTP AUTH + send proof (no SSH required).
 * Evidence-driven: Postfix advertises PLAIN only.
 *
 * Usage:
 *   node scripts/e2e-smtp-auth-plain.mjs
 *
 * Env:
 *   SMTP_HOST (default mail.globalorbitmail.cloud)
 *   RC_USER / RC_PASS (default recaption@zenspanp.com)
 *   RC_TO (default same as user, or set Gmail)
 */
import tls from "node:tls";
import net from "node:net";

const HOST = process.env.SMTP_HOST || "mail.globalorbitmail.cloud";
const USER = process.env.RC_USER || "recaption@zenspanp.com";
const PASS = process.env.RC_PASS || "@Zenspa12345";
const TO = process.env.RC_TO || USER;

function mask(s) {
  return s ? "***" : "(empty)";
}

async function smtpSession({ port, starttls, authMode }) {
  const lines = [];
  const sock = await new Promise((resolve, reject) => {
    const s =
      port === 465
        ? tls.connect({ host: HOST, port, servername: HOST, rejectUnauthorized: false }, () =>
            resolve(s),
          )
        : net.connect({ host: HOST, port }, () => resolve(s));
    s.setEncoding("utf8");
    s.on("error", reject);
  });

  const read = () =>
    new Promise((resolve) => {
      let buf = "";
      const onData = (chunk) => {
        buf += chunk;
        const parts = buf.split(/\r?\n/);
        // complete if last full line starts with XXX␠
        const completed = parts
          .filter(Boolean)
          .some((ln, i, arr) => i === arr.length - 1 && /^\d{3} /.test(ln));
        if (completed || buf.length > 20000) {
          sock.off("data", onData);
          resolve(buf);
        }
      };
      sock.on("data", onData);
    });

  const send = async (cmd) => {
    sock.write(cmd + "\r\n");
    const resp = await read();
    lines.push({ cmd: cmd.startsWith("AUTH") ? "AUTH ***" : cmd, resp: resp.trim() });
    return resp;
  };

  let banner = await read();
  lines.push({ cmd: "(banner)", resp: banner.trim() });

  if (starttls) {
    await send("EHLO orbit-e2e");
    await send("STARTTLS");
    await new Promise((resolve, reject) => {
      const secured = tls.connect(
        { socket: sock, servername: HOST, rejectUnauthorized: false },
        () => resolve(secured),
      );
      secured.on("error", reject);
      // replace read/send to use secured — simplify: recreate flow for 587 in separate path
    });
  }

  // For 465 we already have TLS. For 587 use dedicated function below.
  if (port === 465) {
    const ehlo = await send("EHLO orbit-e2e");
    if (authMode === "LOGIN") {
      let r = await send("AUTH LOGIN");
      if (!r.startsWith("334")) return { ok: false, lines, reason: "LOGIN not accepted" };
      r = await send(Buffer.from(USER).toString("base64"));
      r = await send(Buffer.from(PASS).toString("base64"));
      return { ok: r.startsWith("235"), lines, auth: r.trim() };
    }
    const plain = Buffer.from(`\0${USER}\0${PASS}`).toString("base64");
    const auth = await send(`AUTH PLAIN ${plain}`);
    if (!auth.startsWith("235")) return { ok: false, lines, reason: auth.trim() };
    const from = await send(`MAIL FROM:<${USER}>`);
    if (!from.startsWith("250")) return { ok: false, lines, reason: from.trim() };
    const rcpt = await send(`RCPT TO:<${TO}>`);
    if (!rcpt.startsWith("250")) return { ok: false, lines, reason: rcpt.trim() };
    const data = await send("DATA");
    if (!data.startsWith("354")) return { ok: false, lines, reason: data.trim() };
    const stamp = Date.now();
    sock.write(
      `Subject: Orbit PLAIN e2e ${stamp}\r\nFrom: ${USER}\r\nTo: ${TO}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: <orbit-e2e-${stamp}@zenspanp.com>\r\n\r\nOrbit AUTH PLAIN production proof ${stamp}\r\n.\r\n`,
    );
    const accepted = await read();
    lines.push({ cmd: "(DATA body)", resp: accepted.trim() });
    await send("QUIT");
    sock.end();
    return { ok: accepted.startsWith("250"), lines, auth: "235", accepted: accepted.trim() };
  }

  sock.end();
  return { ok: false, lines, reason: "unsupported" };
}

async function smtp587PlainSend() {
  const lines = [];
  const raw = net.connect({ host: HOST, port: 587 });
  raw.setEncoding("utf8");
  await new Promise((res, rej) => {
    raw.once("connect", res);
    raw.once("error", rej);
  });
  const read = () =>
    new Promise((resolve) => {
      let buf = "";
      const onData = (chunk) => {
        buf += chunk;
        const last = buf.trim().split(/\r?\n/).pop() || "";
        if (/^\d{3} /.test(last)) {
          raw.off("data", onData);
          resolve(buf);
        }
      };
      raw.on("data", onData);
    });
  const send = async (cmd, secureSock) => {
    const s = secureSock || raw;
    s.write(cmd + "\r\n");
    // read from same socket — after STARTTLS use tlsSock
    return readFrom(s);
  };
  function readFrom(s) {
    return new Promise((resolve) => {
      let buf = "";
      const onData = (chunk) => {
        buf += chunk;
        const last = buf.trim().split(/\r?\n/).pop() || "";
        if (/^\d{3} /.test(last) || (last.startsWith("250 ") && !last.startsWith("250-"))) {
          // for multi-line 250- keep reading until 250␠
          const linesArr = buf.split(/\r?\n/).filter(Boolean);
          const done = linesArr.some((ln) => /^\d{3} /.test(ln) && !/^\d{3}-/.test(ln));
          if (done) {
            s.off("data", onData);
            resolve(buf);
          }
        }
      };
      s.on("data", onData);
    });
  }

  let banner = await readFrom(raw);
  lines.push({ cmd: "(banner)", resp: banner.trim() });
  raw.write("EHLO orbit-e2e\r\n");
  let caps = await readFrom(raw);
  lines.push({ cmd: "EHLO", resp: caps.trim() });
  raw.write("STARTTLS\r\n");
  let tlsResp = await readFrom(raw);
  lines.push({ cmd: "STARTTLS", resp: tlsResp.trim() });
  const secure = tls.connect({ socket: raw, servername: HOST, rejectUnauthorized: false });
  await new Promise((res, rej) => {
    secure.once("secureConnect", res);
    secure.once("error", rej);
  });
  secure.setEncoding("utf8");
  secure.write("EHLO orbit-e2e\r\n");
  caps = await readFrom(secure);
  lines.push({ cmd: "EHLO(tls)", resp: caps.trim() });
  const plain = Buffer.from(`\0${USER}\0${PASS}`).toString("base64");
  secure.write(`AUTH PLAIN ${plain}\r\n`);
  const auth = await readFrom(secure);
  lines.push({ cmd: "AUTH PLAIN ***", resp: auth.trim() });
  if (!auth.startsWith("235")) {
    secure.end();
    return { ok: false, lines, reason: auth.trim() };
  }
  secure.write(`MAIL FROM:<${USER}>\r\n`);
  let r = await readFrom(secure);
  lines.push({ cmd: `MAIL FROM`, resp: r.trim() });
  secure.write(`RCPT TO:<${TO}>\r\n`);
  r = await readFrom(secure);
  lines.push({ cmd: `RCPT TO`, resp: r.trim() });
  secure.write("DATA\r\n");
  r = await readFrom(secure);
  const stamp = Date.now();
  secure.write(
    `Subject: Orbit PLAIN 587 e2e ${stamp}\r\nFrom: ${USER}\r\nTo: ${TO}\r\n\r\nOrbit AUTH PLAIN via 587 ${stamp}\r\n.\r\n`,
  );
  const accepted = await readFrom(secure);
  lines.push({ cmd: "(DATA)", resp: accepted.trim() });
  secure.write("QUIT\r\n");
  secure.end();
  return { ok: accepted.startsWith("250"), lines, accepted: accepted.trim() };
}

console.log(`Host=${HOST} User=${USER} Pass=${mask(PASS)} To=${TO}\n`);

const login465 = await smtpSession({ port: 465, starttls: false, authMode: "LOGIN" });
console.log(
  login465.ok ? "UNEXPECTED PASS AUTH LOGIN 465" : `PASS  AUTH LOGIN 465 correctly rejected — ${(login465.auth || login465.reason || "").slice(0, 80)}`,
);

const plain465 = await smtpSession({ port: 465, starttls: false, authMode: "PLAIN" });
console.log(
  plain465.ok
    ? `PASS  AUTH PLAIN + SEND 465 — ${plain465.accepted?.slice(0, 60)}`
    : `FAIL  AUTH PLAIN 465 — ${plain465.reason}`,
);

const plain587 = await smtp587PlainSend();
console.log(
  plain587.ok
    ? `PASS  AUTH PLAIN + SEND 587 — ${plain587.accepted?.slice(0, 60)}`
    : `FAIL  AUTH PLAIN 587 — ${plain587.reason}`,
);

const ok = plain465.ok && plain587.ok && !login465.ok;
console.log(`\n=== SMTP AUTH MATRIX ${ok ? "PASS" : "FAIL"} ===`);
console.log("Roundcube must set: $config['smtp_auth_type'] = 'PLAIN';");
process.exit(ok ? 0 : 1);
