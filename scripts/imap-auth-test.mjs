import net from "node:net";
import tls from "node:tls";

const host = process.env.IMAP_HOST;
const user = process.env.IMAP_USER;
const pass = process.env.IMAP_PASS;

if (!host || !user || !pass) {
  console.error("Usage: IMAP_HOST=mail.example.com IMAP_USER=u@d IMAP_PASS=secret node scripts/imap-auth-test.mjs");
  process.exit(2);
}

function tryImap(port, useTls) {
  return new Promise((resolve) => {
    const sock = useTls
      ? tls.connect({ host, port, servername: host, rejectUnauthorized: false })
      : net.connect({ host, port });
    let buf = "";
    let sent = false;
    const t = setTimeout(() => {
      try {
        sock.destroy();
      } catch {
        /* ignore */
      }
      resolve({ port, useTls, ok: false, out: buf.slice(0, 800), err: "timeout" });
    }, 15000);
    sock.on("error", (e) => {
      clearTimeout(t);
      resolve({ port, useTls, ok: false, err: String(e.message), out: buf.slice(0, 800) });
    });
    sock.on("data", (d) => {
      buf += d.toString();
      if (!sent && buf.includes("* OK")) {
        sent = true;
        const escaped = pass.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        sock.write(`a1 LOGIN "${user}" "${escaped}"\r\n`);
      }
      if (/a1 OK/i.test(buf)) {
        clearTimeout(t);
        sock.end();
        resolve({ port, useTls, ok: true, out: buf.slice(0, 800) });
      }
      if (/a1 NO|a1 BAD/i.test(buf)) {
        clearTimeout(t);
        sock.end();
        resolve({ port, useTls, ok: false, out: buf.slice(0, 800) });
      }
    });
  });
}

const r993 = await tryImap(993, true);
console.log(JSON.stringify(r993, null, 2));
const r143 = await tryImap(143, false);
console.log(JSON.stringify(r143, null, 2));
