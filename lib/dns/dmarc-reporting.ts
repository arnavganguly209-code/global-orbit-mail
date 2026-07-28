/**
 * Resolve a real mailbox for DMARC rua/ruf — never invent addresses.
 */

import { prisma } from "@/lib/db";

const PREFERRED_LOCAL_PARTS = ["dmarc", "postmaster", "abuse", "admin"] as const;

/**
 * Returns an existing active/pending mailbox email suitable for DMARC reports,
 * or null when none exist (caller must omit rua/ruf).
 */
export async function resolveDmarcReportingEmail(
  domainId: string,
  apex: string,
): Promise<string | null> {
  const domain = apex.toLowerCase().trim();
  const rows = await prisma.mailbox.findMany({
    where: {
      domainId,
      deletedAt: null,
      status: { notIn: ["DISABLED"] },
    },
    select: { localPart: true },
    take: 200,
  });
  if (rows.length === 0) return null;

  const byLocal = new Map(
    rows.map((r) => [r.localPart.toLowerCase(), `${r.localPart.toLowerCase()}@${domain}`]),
  );

  for (const local of PREFERRED_LOCAL_PARTS) {
    const hit = byLocal.get(local);
    if (hit) return hit;
  }

  // No dedicated reporting mailbox — omit rua/ruf (do not invent dmarc@).
  return null;
}
