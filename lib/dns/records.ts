import type { DnsRecordStatus, DnsRecordType } from "@prisma/client";

const MAIL_HOST = process.env.MAIL_HOSTNAME ?? "mail.theglobalorbit.com";

export function buildDnsRecordsForDomain(domainName: string) {
  const name = domainName.toLowerCase();
  return [
    {
      type: "MX" as DnsRecordType,
      name,
      value: `10 ${MAIL_HOST}.`,
      priority: 10,
      status: "PENDING" as DnsRecordStatus,
      ttl: 3600,
    },
    {
      type: "SPF" as DnsRecordType,
      name,
      value: `v=spf1 mx a:${MAIL_HOST} ~all`,
      priority: null as number | null,
      status: "PENDING" as DnsRecordStatus,
      ttl: 3600,
    },
    {
      type: "DKIM" as DnsRecordType,
      name: `orbit._domainkey.${name}`,
      value:
        "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0PLACEHOLDER_KEY_MATERIAL_REPLACE_ON_PROVISION",
      priority: null as number | null,
      status: "PENDING" as DnsRecordStatus,
      ttl: 3600,
    },
    {
      type: "DMARC" as DnsRecordType,
      name: `_dmarc.${name}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${name}`,
      priority: null as number | null,
      status: "PENDING" as DnsRecordStatus,
      ttl: 3600,
    },
  ];
}
