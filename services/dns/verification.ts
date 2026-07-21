import { promises as dns } from "node:dns";
import { connect as tlsConnect } from "node:tls";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { DnsRecordStatus, VerificationKind, VerificationState } from "@prisma/client";
import { getMailHostname } from "@/lib/dns/records";
import { isUsableIpv4 } from "@/lib/dns/mail-ip";

export type CheckResult = {
  ok: boolean;
  label: string;
  expected: string;
  observed: string[];
  detail: string;
};

export type DomainVerifyReport = {
  domainId: string;
  domain: string;
  mx: CheckResult;
  spf: CheckResult;
  mailA: CheckResult;
  dkim: CheckResult;
  dmarc: CheckResult;
  ssl: CheckResult;
  /** True when required mail DNS (MX + SPF + mail A) is valid */
  ready: boolean;
  requiredPassed: number;
  requiredTotal: number;
  waitingFor: string | null;
  overall: "VERIFIED" | "PARTIAL" | "FAILED" | "PENDING";
  checkedAt: string;
};

function normalizeTxt(values: string[][]): string[] {
  return values.map((parts) => parts.join("")).map((v) => v.replace(/^"|"$/g, "").trim());
}

function includesSpf(observed: string[], expected: string): boolean {
  const want = expected.toLowerCase();
  return observed.some((o) => {
    const v = o.toLowerCase();
    return v.includes("v=spf1") && (v.includes(want) || want.includes(v) || softSpfMatch(v, want));
  });
}

function softSpfMatch(observed: string, expected: string): boolean {
  const host = getMailHostname().toLowerCase();
  return observed.includes("v=spf1") && expected.includes("v=spf1") && observed.includes(host);
}

function includesDkim(observed: string[], expected: string): boolean {
  const pExpected = extractDkimP(expected);
  if (!pExpected) {
    return observed.some((o) => o.toLowerCase().includes("v=dkim1"));
  }
  return observed.some((o) => {
    const p = extractDkimP(o);
    return p != null && p === pExpected;
  });
}

function extractDkimP(value: string): string | null {
  const match = /(?:^|;)\s*p=([A-Za-z0-9+/=]+)/i.exec(value.replace(/\s+/g, ""));
  return match?.[1] ?? null;
}

function includesDmarc(observed: string[]): boolean {
  return observed.some((o) => o.toLowerCase().startsWith("v=dmarc1"));
}

async function lookupMx(host: string): Promise<string[]> {
  try {
    const rows = await dns.resolveMx(host);
    return rows
      .sort((a, b) => a.priority - b.priority)
      .map((r) => `${r.priority} ${r.exchange.replace(/\.$/, "").toLowerCase()}.`);
  } catch {
    return [];
  }
}

async function lookupTxt(host: string): Promise<string[]> {
  try {
    return normalizeTxt(await dns.resolveTxt(host));
  } catch {
    return [];
  }
}

async function lookupA(host: string): Promise<string[]> {
  try {
    return await dns.resolve4(host);
  } catch {
    return [];
  }
}

async function checkSsl(hostname: string): Promise<CheckResult> {
  const host = hostname.replace(/\.$/, "");
  return new Promise((resolve) => {
    const socket = tlsConnect(
      { host, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 },
      () => {
        const cert = socket.getPeerCertificate();
        const valid =
          socket.authorized ||
          (cert && typeof cert === "object" && "valid_to" in cert && Boolean(cert.valid_to));
        const detail = socket.authorized
          ? "TLS certificate trusted"
          : cert?.subject?.CN
            ? `TLS present (CN=${cert.subject.CN}); authorization=${socket.authorizationError ?? "ok"}`
            : "TLS handshake completed without peer certificate details";
        socket.end();
        resolve({
          ok: Boolean(valid),
          label: "SSL",
          expected: host,
          observed: cert?.subject?.CN ? [String(cert.subject.CN)] : [],
          detail,
        });
      },
    );
    socket.on("error", (error) => {
      resolve({
        ok: false,
        label: "SSL",
        expected: host,
        observed: [],
        detail: error.message || "TLS check failed",
      });
    });
    socket.setTimeout(8000, () => {
      socket.destroy();
      resolve({
        ok: false,
        label: "SSL",
        expected: host,
        observed: [],
        detail: "TLS check timed out",
      });
    });
  });
}

async function upsertVerification(
  domainId: string,
  organizationId: string,
  kind: VerificationKind,
  state: VerificationState,
  target: string,
  detail: string,
) {
  const existing = await prisma.verification.findFirst({
    where: { domainId, kind },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await prisma.verification.update({
      where: { id: existing.id },
      data: { state, target, detail, checkedAt: new Date() },
    });
    return;
  }
  await prisma.verification.create({
    data: {
      kind,
      state,
      domainId,
      organizationId,
      target,
      detail,
      checkedAt: new Date(),
    },
  });
}

function toRecordStatus(ok: boolean, observed: string[]): DnsRecordStatus {
  if (ok) return "VERIFIED";
  if (observed.length === 0) return "MISSING";
  return "MISMATCH";
}

export const dnsVerificationService = {
  async verifyDomain(domainId: string, actorId?: string | null): Promise<DomainVerifyReport> {
    const domain = await prisma.domain.findFirst({
      where: { id: domainId, deletedAt: null },
      include: { dnsRecords: { where: { deletedAt: null } } },
    });
    if (!domain) {
      throw new Error("Domain not found");
    }

    await prisma.domain.update({
      where: { id: domainId },
      data: { status: "VERIFYING", dnsStatus: "PENDING" },
    });

    const mailHost = getMailHostname().toLowerCase().replace(/\.$/, "");
    const expectedMx = domain.dnsRecords.find((r) => r.type === "MX");
    const expectedSpf = domain.dnsRecords.find((r) => r.type === "SPF");
    const expectedMailA = domain.dnsRecords.find(
      (r) => r.type === "A" && (r.name.startsWith("mail.") || r.name === `mail.${domain.name}`),
    );
    const expectedDkim = domain.dnsRecords.find((r) => r.type === "DKIM");
    const expectedDmarc = domain.dnsRecords.find((r) => r.type === "DMARC");

    const mxObserved = await lookupMx(domain.name);
    const mxOk =
      mxObserved.some((row) => row.toLowerCase().includes(mailHost)) ||
      (expectedMx
        ? mxObserved.some((row) =>
            row
              .toLowerCase()
              .includes(
                expectedMx.value.toLowerCase().replace(/^\d+\s+/, "").replace(/\.$/, ""),
              ),
          )
        : false);

    const spfObserved = await lookupTxt(domain.name);
    const spfOk = expectedSpf
      ? includesSpf(spfObserved, expectedSpf.value)
      : spfObserved.some((v) => v.toLowerCase().startsWith("v=spf1"));

    const mailAHost = expectedMailA?.name ?? `mail.${domain.name}`;
    const mailAObserved = await lookupA(mailAHost);
    const expectedIp = (expectedMailA?.value ?? "").trim();
    const mailAOk =
      (isUsableIpv4(expectedIp) && mailAObserved.includes(expectedIp)) ||
      (!expectedIp && mailAObserved.some((ip) => isUsableIpv4(ip)));

    const dkimHost =
      expectedDkim?.name ?? `${domain.dkimSelector || "orbit"}._domainkey.${domain.name}`;
    const dkimObserved = await lookupTxt(dkimHost);
    const dkimOk = expectedDkim
      ? includesDkim(dkimObserved, expectedDkim.value)
      : dkimObserved.some((v) => v.toLowerCase().includes("v=dkim1"));

    const dmarcHost = expectedDmarc?.name ?? `_dmarc.${domain.name}`;
    const dmarcObserved = await lookupTxt(dmarcHost);
    const dmarcOk = includesDmarc(dmarcObserved);

    const sslHost = mailHost;
    const ssl = await checkSsl(sslHost);

    const mx: CheckResult = {
      ok: mxOk,
      label: "MX",
      expected: expectedMx?.value ?? `10 ${mailHost}.`,
      observed: mxObserved,
      detail: mxOk ? "MX points to Global Orbit mail host" : "MX missing or not pointing to mail host",
    };
    const spf: CheckResult = {
      ok: spfOk,
      label: "SPF",
      expected: expectedSpf?.value ?? `v=spf1 mx a:${mailHost} -all`,
      observed: spfObserved.filter((v) => v.toLowerCase().includes("v=spf1")),
      detail: spfOk ? "SPF TXT verified" : "SPF TXT missing or mismatch",
    };
    const mailA: CheckResult = {
      ok: mailAOk,
      label: "A (mail)",
      expected: expectedIp || "production mail IPv4",
      observed: mailAObserved,
      detail: mailAOk
        ? `mail.${domain.name} resolves to the mail server`
        : `A record for mail.${domain.name} missing or incorrect`,
    };
    const dkim: CheckResult = {
      ok: dkimOk,
      label: "DKIM",
      expected: expectedDkim?.value ?? "v=DKIM1; k=rsa; p=…",
      observed: dkimObserved,
      detail: dkimOk ? "DKIM TXT verified" : "DKIM TXT missing or public key mismatch",
    };
    const dmarc: CheckResult = {
      ok: dmarcOk,
      label: "DMARC",
      expected: expectedDmarc?.value ?? `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain.name}`,
      observed: dmarcObserved,
      detail: dmarcOk ? "DMARC TXT verified" : "DMARC TXT missing",
    };

    for (const record of domain.dnsRecords) {
      let status: DnsRecordStatus = record.status;
      if (record.type === "MX") status = toRecordStatus(mxOk, mxObserved);
      if (record.type === "SPF") status = toRecordStatus(spfOk, spfObserved);
      if (record.type === "A" && record.name.startsWith("mail.")) {
        status = toRecordStatus(mailAOk, mailAObserved);
      }
      if (record.type === "DKIM") status = toRecordStatus(dkimOk, dkimObserved);
      if (record.type === "DMARC") status = toRecordStatus(dmarcOk, dmarcObserved);
      if (status !== record.status) {
        await prisma.dnsRecord.update({ where: { id: record.id }, data: { status } });
      }
    }

    const requiredChecks = [mailA, mx, spf];
    const requiredPassed = requiredChecks.filter((c) => c.ok).length;
    const requiredTotal = requiredChecks.length;
    const ready = requiredPassed === requiredTotal;
    const waitingFor =
      requiredChecks.find((c) => !c.ok)?.label ?? null;

    // overall reflects required readiness for product UX (advanced DKIM/DMARC optional)
    let overall: DomainVerifyReport["overall"] = "PENDING";
    if (ready) overall = "VERIFIED";
    else if (requiredPassed === 0) overall = "FAILED";
    else overall = "PARTIAL";

    const dnsStatus =
      overall === "VERIFIED" ? "VERIFIED" : overall === "FAILED" ? "FAILED" : "PARTIAL";

    await upsertVerification(
      domain.id,
      domain.organizationId,
      "DNS_MX",
      mx.ok ? "VERIFIED" : "FAILED",
      domain.name,
      mx.detail,
    );
    await upsertVerification(
      domain.id,
      domain.organizationId,
      "DNS_SPF",
      spf.ok ? "VERIFIED" : "FAILED",
      domain.name,
      spf.detail,
    );
    await upsertVerification(
      domain.id,
      domain.organizationId,
      "DNS_DKIM",
      dkim.ok ? "VERIFIED" : "FAILED",
      dkimHost,
      dkim.detail,
    );
    await upsertVerification(
      domain.id,
      domain.organizationId,
      "DNS_DMARC",
      dmarc.ok ? "VERIFIED" : "FAILED",
      dmarcHost,
      dmarc.detail,
    );
    await upsertVerification(
      domain.id,
      domain.organizationId,
      "SSL",
      ssl.ok ? "VERIFIED" : "FAILED",
      sslHost,
      ssl.detail,
    );

    await prisma.domain.update({
      where: { id: domain.id },
      data: {
        dnsStatus,
        sslStatus: ssl.ok ? "ACTIVE" : domain.sslStatus === "NONE" ? "PENDING" : domain.sslStatus,
        // Ready as soon as required DNS is valid — never leave customers on VERIFYING
        status: ready ? "ACTIVE" : overall === "FAILED" ? "PENDING" : "VERIFYING",
        verifiedAt: ready ? new Date() : domain.verifiedAt,
        mailStatus: ready
          ? domain.mailStatus === "DISABLED" || domain.mailStatus === "PROVISIONING"
            ? "ACTIVE"
            : domain.mailStatus
          : domain.mailStatus === "DISABLED"
            ? "PROVISIONING"
            : domain.mailStatus,
      },
    });

    await writeAudit({
      actorId,
      action: "dns.verify",
      resource: "domain",
      resourceId: domain.id,
      metadata: {
        overall,
        ready,
        requiredPassed,
        mx: mx.ok,
        spf: spf.ok,
        mailA: mailA.ok,
        dkim: dkim.ok,
        dmarc: dmarc.ok,
        ssl: ssl.ok,
      },
    });

    return {
      domainId: domain.id,
      domain: domain.name,
      mx,
      spf,
      mailA,
      dkim,
      dmarc,
      ssl,
      ready,
      requiredPassed,
      requiredTotal,
      waitingFor,
      overall,
      checkedAt: new Date().toISOString(),
    };
  },
};
