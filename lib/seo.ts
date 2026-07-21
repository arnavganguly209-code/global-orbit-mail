import type { Metadata } from "next";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";

const siteUrl = appConfig.url;

const defaultTitle = `${brand.product} — Enterprise Email Hosting`;
const defaultDescription = appConfig.description;

export function createPageMetadata({
  title,
  description = defaultDescription,
  path = "/",
  noIndex = false,
}: {
  title: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteUrl}${path === "/" ? "" : path}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: brand.product,
      title: `${title} · ${brand.product}`,
      description,
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
      title: `${title} · ${brand.product}`,
      description,
      images: [brand.assets.ogImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export const siteMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: `%s · ${brand.product}`,
  },
  description: defaultDescription,
  applicationName: brand.product,
  authors: [{ name: brand.company }],
  creator: brand.company,
  publisher: brand.company,
  category: "technology",
  alternates: {
    canonical: siteUrl,
  },
  keywords: [
    "enterprise email hosting",
    "business email",
    "white-label email",
    "custom domain email",
    "secure business mail",
    brand.product,
    brand.name,
    "SPF DKIM DMARC",
    "professional webmail",
    "GDPR email hosting",
    "email migration",
    brand.domain,
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: brand.product,
    title: `${brand.product} — Enterprise Email Hosting Built For Modern Businesses`,
    description: defaultDescription,
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
    title: defaultTitle,
    description: defaultDescription,
    images: [brand.assets.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: brand.assets.favicon ?? brand.assets.logo,
    apple: brand.assets.logo,
  },
};
