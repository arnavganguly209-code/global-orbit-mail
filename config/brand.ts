/**
 * GLOBAL ORBIT MAIL — Brand Identity
 * Official logo lives in /public/brand/logo.png (swap without UI redesign).
 */

export const brand = {
  company: "GLOBAL ORBIT PVT. LTD.",
  name: "GLOBAL ORBIT",
  product: "GLOBAL ORBIT MAIL",
  tagline: "Enterprise Email Hosting",
  shortName: "Orbit Mail",
  domain: "theglobalorbit.com",
  siteHost: "mail.theglobalorbit.com",
  companyUrl: "https://theglobalorbit.com/",
  portals: {
    user: "webmail.theglobalorbit.com",
    admin: "admin.theglobalorbit.com",
  },
  assets: {
    logo: "/brand/logo.png",
    logoMark: "/brand/logo.png",
    logoWordmark: "/brand/logo.png",
    favicon: "/brand/favicon.svg",
    ogImage: "/brand/logo.png",
  },
  logoWidth: 240,
} as const;

export type BrandConfig = typeof brand;
