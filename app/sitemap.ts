import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";
import { routes } from "@/config/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appConfig.url;
  return [
    { url: `${base}${routes.home}`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}${routes.login}`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    {
      url: `${base}${routes.adminLogin}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
