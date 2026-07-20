import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";
import { routes } from "@/config/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appConfig.url;
  return [
    { url: `${base}${routes.home}`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}${routes.legal.privacy}`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}${routes.legal.terms}`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}${routes.legal.refund}`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}${routes.legal.cookies}`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];
}
