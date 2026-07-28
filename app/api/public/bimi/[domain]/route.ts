import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeApexDomain, isValidApexDomain } from "@/lib/dns/domain-name";
import { decodeSvgDataUrl, isSvgDataUrl, looksLikeSvg } from "@/lib/bimi";

export const dynamic = "force-dynamic";

/**
 * Public BIMI logo endpoint.
 * Serves SVG Tiny PS when the domain branding logo is stored as SVG.
 * PNG/JPEG uploads are not BIMI-compatible — returns 404 with a clear message.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ domain: string }> },
) {
  const { domain: raw } = await context.params;
  const apex = normalizeApexDomain(decodeURIComponent(raw || ""));
  if (!apex || !isValidApexDomain(apex)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const row = await prisma.domain.findFirst({
    where: {
      deletedAt: null,
      name: { equals: apex, mode: "insensitive" },
    },
    select: { logoDataUrl: true, name: true },
  });

  if (!row?.logoDataUrl) {
    return NextResponse.json(
      {
        error: "No BIMI logo configured",
        detail: "Upload an SVG Tiny PS logo in /orbit domain branding, then publish BIMI DNS + VMC for Gmail.",
      },
      { status: 404 },
    );
  }

  if (!isSvgDataUrl(row.logoDataUrl)) {
    return NextResponse.json(
      {
        error: "BIMI requires SVG",
        detail:
          "Gmail BIMI only accepts SVG Tiny PS. Re-upload the company logo as SVG in /orbit (PNG/JPEG cannot fill the Gmail profile circle).",
      },
      { status: 404 },
    );
  }

  const svg = decodeSvgDataUrl(row.logoDataUrl);
  if (!svg || !looksLikeSvg(svg)) {
    return NextResponse.json({ error: "Invalid SVG logo data" }, { status: 422 });
  }

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
