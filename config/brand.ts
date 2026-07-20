/**
 * GLOBAL ORBIT MAIL — Brand Identity
 * Logo assets live in /public/brand and can be swapped without UI redesign.
 */

export const brand = {
  company: "GLOBAL ORBIT PVT. LTD.",
  name: "GLOBAL ORBIT",
  product: "GLOBAL ORBIT MAIL",
  tagline: "Enterprise Mail Platform",
  shortName: "Orbit Mail",
  domain: "theglobalorbit.com",
  portals: {
    user: "webmail.theglobalorbit.com",
    admin: "orbit.theglobalorbit.com",
  },
  assets: {
    logoMark: "/brand/logo-mark.svg",
    logoWordmark: "/brand/logo-wordmark.svg",
    favicon: "/brand/favicon.svg",
    ogImage: "/brand/og-image.svg",
  },
} as const;

export type BrandConfig = typeof brand;
