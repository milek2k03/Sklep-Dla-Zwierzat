import type { MetadataRoute } from "next";
import { getPublishedProducts } from "@/lib/products";

const siteUrl = (
  process.env.NEXT_PUBLIC_APP_URL || "https://www.pawlypetshop.pl"
).replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getPublishedProducts({ fallback: true });
  const now = new Date();

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/produkty`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/regulamin`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/polityka-prywatnosci`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    ...products.map((product) => ({
      url: `${siteUrl}/produkt/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: product.imageUrls?.length
        ? product.imageUrls
        : product.imageUrl
          ? [product.imageUrl]
          : undefined,
    })),
  ];
}
