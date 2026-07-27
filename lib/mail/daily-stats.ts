/**
 * Increment daily mail metrics (UTC date bucket).
 */

import { prisma } from "@/lib/db";

function utcDateOnly(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function bumpMailDailyStat(
  field: "sentCount" | "spamActionCount" | "loginCount",
  by = 1,
) {
  const statDate = utcDateOnly();
  await prisma.mailDailyStat.upsert({
    where: { statDate },
    create: {
      statDate,
      sentCount: field === "sentCount" ? by : 0,
      spamActionCount: field === "spamActionCount" ? by : 0,
      loginCount: field === "loginCount" ? by : 0,
    },
    update: {
      [field]: { increment: by },
    },
  });
}

export async function getMailTrafficSeries(days = 30) {
  const since = utcDateOnly();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const rows = await prisma.mailDailyStat.findMany({
    where: { statDate: { gte: since } },
    orderBy: { statDate: "asc" },
  });
  const map = new Map(rows.map((r) => [r.statDate.toISOString().slice(0, 10), r]));
  const out: { label: string; mail: number; spam: number; login: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    out.push({
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      mail: row?.sentCount ?? 0,
      spam: row?.spamActionCount ?? 0,
      login: row?.loginCount ?? 0,
    });
  }
  return out;
}
