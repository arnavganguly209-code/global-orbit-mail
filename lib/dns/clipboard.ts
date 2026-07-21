/**
 * Client-safe DNS clipboard helpers.
 * No Node built-ins. Safe to import from "use client" modules.
 */

export type DnsClipboardRecord = {
  type?: string;
  publishType?: string;
  label?: string;
  host?: string;
  name?: string;
  value: string;
  priority?: number | null;
  ttl?: number | null;
};

export function formatDnsRecordsForClipboard(
  records: DnsClipboardRecord[],
  domainName?: string,
) {
  const header = domainName ? `# Required DNS Records for ${domainName}\n` : "# Required DNS Records\n";
  const lines = records.map((r) => {
    const host = r.host ?? r.name ?? "@";
    const kind = r.publishType ?? r.type ?? "TXT";
    const priority =
      r.priority != null && String(kind).toUpperCase() === "MX" ? `\tPriority ${r.priority}` : "";
    const ttl = r.ttl != null ? `\tTTL ${r.ttl}` : "";
    const label = r.label ? `# ${r.label}\n` : "";
    return `${label}${kind}\t${host}\t${r.value}${priority}${ttl}`;
  });
  return `${header}${lines.join("\n\n")}`;
}

export function formatSingleDnsRecordForClipboard(record: DnsClipboardRecord) {
  const lines = [
    `Type: ${record.publishType ?? record.type ?? "TXT"}`,
    `Host: ${record.host ?? record.name ?? "@"}`,
    `Value: ${record.value}`,
  ];
  if (record.priority != null) lines.push(`Priority: ${record.priority}`);
  if (record.ttl != null) lines.push(`TTL: ${record.ttl}`);
  return lines.join("\n");
}
