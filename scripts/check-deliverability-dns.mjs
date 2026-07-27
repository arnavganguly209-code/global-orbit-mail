/**
 * External deliverability DNS audit (no SSH required).
 *
 * Usage:
 *   node scripts/check-deliverability-dns.mjs zenspanp.com
 *   node scripts/check-deliverability-dns.mjs zenspanp.com theglobalorbit.com
 */
import { Resolver } from "node:dns/promises";
import { createConnection } from "node:net";

const resolver = new Resolver();
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

const MAIL_IP = process.env.MAIL_SERVER_IPV4 || "200.97.170.235";
const PUBLIC_MX = process.env.MAIL_HOSTNAME || "mail.globalorbitmail.cloud";
const domains = process.argv.slice(2);
if (domains.length === 0) domains.push("zenspanp.com");

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}
function info(name, detail = "") {
  results.push({ name, ok: true, detail: `INFO ${detail}` });
  console.log(`INFO  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function txt(name) {
  try {
    const rows = await resolver.resolveTxt(name);
    return rows.map((r) => r.join("")).join(" | ");
  } catch {
    return "";
  }
}

async function mx(name) {
  try {
    const rows = await resolver.resolveMx(name);
    return rows
      .sort((a, b) => a.priority - b.priority)
      .map((r) => `${r.priority} ${r.exchange}`)
      .join(", ");
  } catch {
    return "";
  }
}

async function a(name) {
  try {
    return (await resolver.resolve4(name)).join(", ");
  } catch {
    return "";
  }
}

async function ptr(ip) {
  try {
    return (await resolver.reverse(ip)).join(", ");
  } catch {
    return "";
  }
}

function dnsbl(ip) {
  const rev = ip.split(".").reverse().join(".");
  const zones = [
    "zen.spamhaus.org",
    "bl.spamcop.net",
    "b.barracudacentral.org",
    "dnsbl.sorbs.net",
  ];
  return Promise.all(
    zones.map(async (z) => {
      try {
        const ans = await resolver.resolve4(`${rev}.${z}`);
        const codes = ans.join(",");
        // Spamhaus returns 127.255.255.254 when public resolvers (1.1.1.1/8.8.8.8)
        // are blocked — that is NOT a listing.
        if (codes.includes("127.255.255.254") || codes.includes("127.255.255.255")) {
          return { z, listed: false, unknown: true, ans: codes };
        }
        return { z, listed: true, unknown: false, ans: codes };
      } catch {
        return { z, listed: false, unknown: false, ans: "" };
      }
    }),
  );
}

function tcpProbe(host, port, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const t = setTimeout(() => {
      sock.destroy();
      resolve({ ok: false, err: "timeout" });
    }, timeoutMs);
    sock.on("connect", () => {
      clearTimeout(t);
      sock.end();
      resolve({ ok: true });
    });
    sock.on("error", (e) => {
      clearTimeout(t);
      resolve({ ok: false, err: e.message });
    });
  });
}

console.log(`Mail IP=${MAIL_IP}  Public MX=${PUBLIC_MX}\n`);

const ptrName = await ptr(MAIL_IP);
if (ptrName) {
  const fwd = await a(ptrName.split(",")[0].trim());
  if (fwd.includes(MAIL_IP)) {
    pass("PTR/FCrDNS", `${MAIL_IP} → ${ptrName} → ${fwd}`);
  } else {
    fail("PTR/FCrDNS", `PTR=${ptrName} A=${fwd} (expected ${MAIL_IP})`);
  }
  if (ptrName.includes("mail.globalorbitmail.cloud")) {
    pass("PTR brand hostname", ptrName);
  } else {
    info(
      "PTR brand hostname",
      `PTR is ${ptrName}; brand MX is ${PUBLIC_MX}. EHLO must match PTR until ISP updates reverse DNS.`,
    );
  }
} else {
  fail("PTR", "no reverse DNS");
}

const mxHostA = await a(PUBLIC_MX);
if (mxHostA.includes(MAIL_IP)) pass("Public MX A", `${PUBLIC_MX} → ${mxHostA}`);
else fail("Public MX A", `${PUBLIC_MX} → ${mxHostA}`);

for (const domain of domains) {
  console.log(`\n--- ${domain} ---`);
  const mxRec = await mx(domain);
  if (mxRec.toLowerCase().includes(PUBLIC_MX.toLowerCase()) || mxRec.includes("mail.theglobalorbit.com")) {
    pass(`${domain} MX`, mxRec);
  } else if (mxRec) {
    info(`${domain} MX`, mxRec);
  } else {
    fail(`${domain} MX`, "missing");
  }

  const spf = await txt(domain);
  const spfRec = spf.split(" | ").find((t) => t.startsWith("v=spf1")) || "";
  if (spfRec.includes("v=spf1") && (spfRec.includes(MAIL_IP) || spfRec.includes("mx") || spfRec.includes(PUBLIC_MX))) {
    pass(`${domain} SPF`, spfRec);
  } else {
    fail(`${domain} SPF`, spfRec || "missing");
  }

  const dkim = await txt(`orbit._domainkey.${domain}`);
  if (dkim.includes("v=DKIM1") && dkim.includes("p=")) pass(`${domain} DKIM orbit`, dkim.slice(0, 80) + "…");
  else fail(`${domain} DKIM orbit`, dkim || "missing TXT");

  const dmarc = await txt(`_dmarc.${domain}`);
  if (dmarc.includes("v=DMARC1")) pass(`${domain} DMARC`, dmarc);
  else fail(`${domain} DMARC`, dmarc || "missing");
}

console.log("\n--- DNSBL ---");
const bl = await dnsbl(MAIL_IP);
for (const row of bl) {
  if (row.unknown) info(`DNSBL ${row.z}`, `query blocked by zone (${row.ans}) — check https://check.spamhaus.org/`);
  else if (row.listed) fail(`DNSBL ${row.z}`, row.ans);
  else pass(`DNSBL ${row.z}`, "clear");
}

console.log("\n--- SMTP :25 reachability from this host ---");
const smtp = await tcpProbe(MAIL_IP, 25);
if (smtp.ok) pass("SMTP:25 to mail IP", "open");
else info("SMTP:25 to mail IP", `not reachable from this network (${smtp.err}) — normal if provider filters inbound 25 from residential`);

const ok = results.filter((r) => r.ok).length;
const bad = results.filter((r) => !r.ok).length;
console.log(`\n=== SUMMARY ${ok} ok / ${bad} fail ===`);
process.exit(bad > 0 ? 1 : 0);
