/**
 * GLOBAL ORBIT MAIL — Application Configuration
 */

import { brand } from "@/config/brand";

export const appConfig = {
  brand,
  name: brand.product,
  description:
    "Premium white-label enterprise email platform for organizations that demand absolute control, security, and elegance.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  userPortalUrl:
    process.env.NEXT_PUBLIC_USER_PORTAL_URL ?? `https://${brand.portals.user}`,
  adminPortalUrl:
    process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL ?? `https://${brand.portals.admin}`,
  supportEmail: `support@${brand.domain}`,
  version: "0.1.0",
  phase: 1,
} as const;

export type AppConfig = typeof appConfig;
