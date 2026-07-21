import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";
import { routes } from "@/config/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appConfig.url;
  const now = new Date();

  const entries: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
    { path: routes.home, changeFrequency: "weekly", priority: 1 },
    { path: routes.pages.features, changeFrequency: "weekly", priority: 0.9 },
    { path: routes.pages.pricing, changeFrequency: "weekly", priority: 0.9 },
    { path: routes.pages.businessEmail, changeFrequency: "monthly", priority: 0.8 },
    { path: routes.pages.enterprise, changeFrequency: "monthly", priority: 0.8 },
    { path: routes.pages.about, changeFrequency: "monthly", priority: 0.7 },
    { path: routes.pages.contact, changeFrequency: "monthly", priority: 0.7 },
    { path: routes.pages.documentation, changeFrequency: "monthly", priority: 0.7 },
    { path: routes.legal.privacy, changeFrequency: "yearly", priority: 0.3 },
    { path: routes.legal.terms, changeFrequency: "yearly", priority: 0.3 },
    { path: routes.legal.refund, changeFrequency: "yearly", priority: 0.2 },
    { path: routes.legal.cookies, changeFrequency: "yearly", priority: 0.2 },
    { path: routes.legal.aup, changeFrequency: "yearly", priority: 0.3 },
    { path: routes.legal.security, changeFrequency: "yearly", priority: 0.3 },
    { path: routes.legal.gdpr, changeFrequency: "yearly", priority: 0.3 },
  ];

  return entries.map((entry) => ({
    url: `${base}${entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
