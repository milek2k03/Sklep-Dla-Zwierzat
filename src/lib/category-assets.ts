import type { ProductCategory } from "@/types/product";

export const defaultCategoryAsset = {
  src: "/images/categories/zestawy.jpg",
  alt: "Produkt Pawly w jasnej sesji produktowej",
  objectPosition: "50% 50%",
  accent: "text-[#7b3f32]",
};

export const categoryAssets: Partial<
  Record<ProductCategory, { src: string; alt: string; objectPosition: string; accent: string }>
> = {
  Spacer: {
    src: "/images/categories/spacer.jpg",
    alt: "Akcesoria spacerowe dla psa w jasnej sesji produktowej",
    objectPosition: "50% 50%",
    accent: "text-[#8a4c1e]",
  },
  Auto: {
    src: "/images/categories/auto.jpg",
    alt: "Akcesoria dla psa do auta na jasnym fotelu samochodowym",
    objectPosition: "50% 50%",
    accent: "text-[#35594d]",
  },
  Dom: {
    src: "/images/categories/dom.jpg",
    alt: "Domowe akcesoria dla psa z miskami, matą i ręcznikiem",
    objectPosition: "50% 50%",
    accent: "text-[#5a6347]",
  },
  Zestawy: {
    src: "/images/categories/zestawy.jpg",
    alt: "Zestaw akcesoriów dla psa ułożony w jasnej sesji produktowej",
    objectPosition: "50% 50%",
    accent: "text-[#7b3f32]",
  },
};
