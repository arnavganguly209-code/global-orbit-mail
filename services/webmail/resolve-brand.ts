/**
 * Resolve public / platform brand assets for login + white-label UI.
 * Domain overrides win over platform SystemSetting.brand / company.
 */

import { prisma } from "@/lib/db";
import { settingsRepository, getDefaultOrganizationId } from "@/repositories";

export type PublicBrand = {
  productName: string;
  companyName: string;
  supportEmail: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  loginLogoUrl: string;
  mailLogoUrl: string;
  headerLogoUrl: string;
  sidebarLogoUrl: string;
  signatureLogoUrl: string;
  faviconUrl: string;
  domainName?: string;
};

const DEFAULTS: PublicBrand = {
  productName: "Global Orbit Mail",
  companyName: "GLOBAL ORBIT PVT LTD",
  supportEmail: null,
  website: null,
  phone: null,
  address: null,
  socialLinks: {},
  primaryColor: "#1a1a1a",
  accentColor: "#d4af37",
  logoUrl: "/brand/logo.png",
  loginLogoUrl: "/brand/logo.png",
  mailLogoUrl: "/brand/logo.png",
  headerLogoUrl: "/brand/logo.png",
  sidebarLogoUrl: "/brand/logo.png",
  signatureLogoUrl: "/brand/logo.png",
  faviconUrl: "/brand/icon-192.png",
};

function str(v: unknown, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export async function getPlatformBrand(): Promise<PublicBrand> {
  const organizationId = await getDefaultOrganizationId();
  const all = await settingsRepository.getAll(organizationId);
  const brand = (all.brand ?? {}) as Record<string, unknown>;
  const company = (all.company ?? {}) as Record<string, unknown>;
  const logo = str(brand.logoPath, DEFAULTS.logoUrl) || DEFAULTS.logoUrl;
  const loginLogo = str(brand.loginLogoPath, logo) || logo;
  const mailLogo = str(brand.mailLogoPath, logo) || logo;
  const headerLogo = str(brand.headerLogoPath, logo) || logo;
  const sidebarLogo = str(brand.sidebarLogoPath, logo) || logo;
  const signatureLogo = str(brand.signatureLogoPath, mailLogo) || mailLogo;
  const favicon = str(brand.faviconPath, DEFAULTS.faviconUrl) || DEFAULTS.faviconUrl;
  const social = (brand.socialLinks ?? company.socialLinks ?? {}) as PublicBrand["socialLinks"];

  return {
    productName: str(brand.product, DEFAULTS.productName) || DEFAULTS.productName,
    companyName: str(company.name, DEFAULTS.companyName) || DEFAULTS.companyName,
    supportEmail: str(company.supportEmail) || null,
    website: str(company.website) || null,
    phone: str(company.phone) || null,
    address: str(company.address) || null,
    socialLinks: {
      linkedin: str(social.linkedin) || undefined,
      twitter: str(social.twitter) || undefined,
      facebook: str(social.facebook) || undefined,
      instagram: str(social.instagram) || undefined,
    },
    primaryColor: str(brand.primaryColor, DEFAULTS.primaryColor) || DEFAULTS.primaryColor,
    accentColor: str(brand.accentColor, DEFAULTS.accentColor) || DEFAULTS.accentColor,
    logoUrl: logo,
    loginLogoUrl: loginLogo,
    mailLogoUrl: mailLogo,
    headerLogoUrl: headerLogo,
    sidebarLogoUrl: sidebarLogo,
    signatureLogoUrl: signatureLogo,
    faviconUrl: favicon,
  };
}

export async function getPublicBrandForDomain(domainName?: string | null): Promise<PublicBrand> {
  const platform = await getPlatformBrand();
  const name = (domainName || "").trim().toLowerCase();
  if (!name) return platform;

  const domain = await prisma.domain.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
    select: {
      name: true,
      companyName: true,
      brandColor: true,
      logoDataUrl: true,
    },
  });
  if (!domain) return { ...platform, domainName: name };

  const logo = domain.logoDataUrl || platform.logoUrl;
  return {
    ...platform,
    domainName: domain.name,
    companyName: domain.companyName || platform.companyName,
    accentColor: domain.brandColor || platform.accentColor,
    logoUrl: logo,
    loginLogoUrl: logo,
    mailLogoUrl: logo,
    headerLogoUrl: logo,
    sidebarLogoUrl: logo,
    signatureLogoUrl: logo,
  };
}
