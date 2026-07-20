import { brand } from "@/config/brand";
import { appConfig } from "@/config/app";

export function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brand.product,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: appConfig.url,
    description: appConfig.description,
    provider: {
      "@type": "Organization",
      name: brand.company,
      url: brand.companyUrl,
      logo: `${appConfig.url}${brand.assets.logo}`,
    },
    offers: [
      {
        "@type": "Offer",
        name: "Starter",
        price: "9.00",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Professional",
        price: "19.00",
        priceCurrency: "USD",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
