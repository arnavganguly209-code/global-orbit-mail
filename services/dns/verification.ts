import { promises as dns } from "node:dns";
import { connect as tlsConnect } from "node:tls";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { DnsRecordStatus, VerificationKind, VerificationState } from "@prisma/client";
import { getMailHostname } from "@/lib/dns/records";

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
  dkim: CheckResult;
  dmarc: CheckResult;
  ssl: CheckResult;
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
  // Accept if both declare v=spf1 and reference our mail host
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
          expected: `Valid TLS on ${host}:443`,
          observed: cert?.subject?.CN ? [String(cert.subject.CN)] : [],
          detail,
        });
      },
    );
    socket.on("error", (err) => {
      resolve({
        ok: false,
        label: "SSL",
        expected: `Valid TLS on ${host}:443`,
        observed: [],
        detail: err.message,
      });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        ok: false,
        label: "SSL",
        expected: `Valid TLS on ${host}:443`,
        observed: [],
        detail: "TLS connection timed out",
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
      data: { state, detail, target, checkedAt: new Date() },
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
    const expectedDkim = domain.dnsRecords.find((r) => r.type === "DKIM");
    const expectedDmarc = domain.dnsRecords.find((r) => r.type === "DMARC");

    const mxObserved = await lookupMx(domain.name);
    const mxOk =
      mxObserved.some((row) => row.toLowerCase().includes(mailHost)) ||
      (expectedMx
        ? mxObserved.some((row) =>
            row.toLowerCase().includes(expectedMx.value.toLowerCase().replace(/^\d+\s+/, "").replace(/\.$/, "")),
          )
        : false);

    const spfObserved = await lookupTxt(domain.name);
    const spfOk = expectedSpf
      ? includesSpf(spfObserved, expectedSpf.value)
      : spfObserved.some((v) => v.toLowerCase().startsWith("v=spf1"));

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

    // Persist per-record statuses
    for (const record of domain.dnsRecords) {
      let status: DnsRecordStatus = record.status;
      if (record.type === "MX") status = toRecordStatus(mxOk, mxObserved);
      if (record.type === "SPF") status = toRecordStatus(spfOk, spfObserved);
      if (record.type === "DKIM") status = toRecordStatus(dkimOk, dkimObserved);
      if (record.type === "DMARC") status = toRecordStatus(dmarcOk, dmarcObserved);
      if (status !== record.status) {
        await prisma.dnsRecord.update({ where: { id: record.id }, data: { status } });
      }
    }

    const checks = [mx, spf, dkim, dmarc];
    const passed = checks.filter((c) => c.ok).length;
    let overall: DomainVerifyReport["overall"] = "PENDING";
    if (passed === checks.length) overall = "VERIFIED";
    else if (passed === 0) overall = "FAILED";
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
        status: overall === "VERIFIED" ? "ACTIVE" : overall === "FAILED" ? "FAILED" : "VERIFYING",
        verifiedAt: overall === "VERIFIED" ? new Date() : domain.verifiedAt,
        mailStatus:
          overall === "VERIFIED" && domain.mailStatus === "DISABLED"
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
        mx: mx.ok,
        spf: spf.ok,
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
      dkim,
      dmarc,
      ssl,
      overall,
      checkedAt: new Date().toISOString(),
    };
  },
};
