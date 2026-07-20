import type { Metadata } from "next";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";

const siteUrl = appConfig.url;

export const siteMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${brand.product} — Enterprise Email Hosting`,
    template: `%s · ${brand.product}`,
  },
  description: appConfig.description,
  applicationName: brand.product,
  authors: [{ name: brand.company }],
  creator: brand.company,
  publisher: brand.company,
  alternates: {
    canonical: siteUrl,
  },
  keywords: [
    "enterprise email hosting",
    "business email",
    "white-label email",
    "custom domain email",
    "secure business mail",
    "GLOBAL ORBIT MAIL",
    "SPF DKIM DMARC",
    "professional webmail",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: brand.product,
    title: `${brand.product} — Enterprise Email Hosting Built For Modern Businesses`,
    description: appConfig.description,
    images: [
      {
        url: brand.assets.ogImage,
        width: 1200,
        height: 630,
        alt: `${brand.product} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.product} — Enterprise Email Hosting`,
    description: appConfig.description,
    images: [brand.assets.ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: brand.assets.logo,
    apple: brand.assets.logo,
  },
};
