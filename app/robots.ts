import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/portal/", "/orbit/", "/api/"],
    },
    sitemap: `${appConfig.url}/sitemap.xml`,
  };
}
