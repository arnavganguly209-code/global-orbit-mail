import { NextResponse } from "next/server";
import { brand } from "@/config/brand";
import { appConfig } from "@/config/app";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: "ok",
      product: brand.product,
      company: brand.company,
      phase: appConfig.phase,
      version: appConfig.version,
      timestamp: new Date().toISOString(),
    },
  });
}
