import type { ProductCategory } from "@/types/product";

export const defaultCategoryAsset = {
  src: "/images/categories/zestawy.jpg",
  alt: "Produkt Pawly Pet Shop w jasnej sesji produktowej",
  objectPosition: "50% 50%",
  accent: "text-[#7b3f32]",
};

export const categoryAssets: Partial<
  Record<ProductCategory, { src: string; alt: string; objectPosition: string; accent: string }>
> = {
  "Dla psa": {
    src: "/images/categories/spacer.jpg",
    alt: "Akcesoria dla psa w jasnej sesji produktowej",
    objectPosition: "50% 50%",
    accent: "text-[#8a4c1e]",
  },
  "Dla kota": {
    src: "/images/categories/dom.jpg",
    alt: "Domowe akcesoria dla kota w jasnej sesji produktowej",
    objectPosition: "50% 50%",
    accent: "text-[#5a6347]",
  },
  "Spacer i podróż": {
    src: "/images/categories/spacer.jpg",
    alt: "Akcesoria dla psa lub kota na spacer i w podróż",
    objectPosition: "50% 50%",
    accent: "text-[#8a4c1e]",
  },
  Auto: {
    src: "/images/categories/auto.jpg",
    alt: "Akcesoria dla pupila do auta na jasnym fotelu samochodowym",
    objectPosition: "50% 50%",
    accent: "text-[#35594d]",
  },
  Dom: {
    src: "/images/categories/dom.jpg",
    alt: "Domowe akcesoria dla psa lub kota z miskami, matą i ręcznikiem",
    objectPosition: "50% 50%",
    accent: "text-[#5a6347]",
  },
  Zestawy: {
    src: "/images/categories/zestawy.jpg",
    alt: "Zestaw akcesoriów dla pupili ułożony w jasnej sesji produktowej",
    objectPosition: "50% 50%",
    accent: "text-[#7b3f32]",
  },
};
