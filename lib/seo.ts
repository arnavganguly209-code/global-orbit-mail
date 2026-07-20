import type { Metadata } from "next";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";

const siteUrl = appConfig.url;

export const siteMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${brand.product} — ${brand.tagline}`,
    template: `%s · ${brand.product}`,
  },
  description: appConfig.description,
  applicationName: brand.product,
  authors: [{ name: brand.company }],
  creator: brand.company,
  publisher: brand.company,
  keywords: [
    "enterprise email",
    "white-label mail",
    "business email platform",
    "GLOBAL ORBIT MAIL",
    "secure enterprise mail",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: brand.product,
    title: `${brand.product} — ${brand.tagline}`,
    description: appConfig.description,
    images: [
      {
        url: brand.assets.ogImage,
        width: 1200,
        height: 630,
        alt: `${brand.product} — ${brand.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.product} — ${brand.tagline}`,
    description: appConfig.description,
    images: [brand.assets.ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: brand.assets.favicon,
  },
};
