import type { Product } from "@/types/product";
import { productCategories } from "@/lib/product-categories";
import { hasSupabaseBrowserEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export { productCategories };

export const products: Product[] = [
  {
    id: "PWL-BND-SPACER-DOG",
    slug: "zestaw-spacer-premium-dla-psa",
    name: "Zestaw Spacer Premium dla psa",
    price: 129.99,
    purchasePrice: 74.99,
    compareAtPrice: 169.99,
    category: "Zestawy",
    rating: 0,
    reviewCount: 0,
    description: "Saszetka, miska i etui na woreczki w jednym zestawie na spacer.",
    tag: "Bestseller",
    stockQuantity: 12,
    features: [
      "saszetka na smaczki",
      "składana miska silikonowa",
      "etui na woreczki",
      "na spacer i krótki wyjazd",
    ],
  },
  {
    id: "PWL-BND-AUTO-DOG",
    slug: "zestaw-czyste-auto-dla-psa",
    name: "Zestaw Czyste Auto dla psa",
    price: 149.99,
    purchasePrice: 84.99,
    category: "Auto",
    rating: 0,
    reviewCount: 0,
    description: "Akcesoria do podróży samochodem z psem i łatwiejszego sprzątania auta.",
    stockQuantity: 8,
    features: [
      "pokrowiec do auta",
      "mniej sierści i piasku na siedzeniach",
      "łatwiejsze sprzątanie po podróży",
    ],
  },
  {
    id: "PWL-HOME-BOWL-MAT",
    slug: "mata-pod-miski-dla-psa-lub-kota",
    name: "Mata pod miski dla psa lub kota",
    price: 59.99,
    purchasePrice: 21.99,
    category: "Dom",
    rating: 0,
    reviewCount: 0,
    description: "Mata pod miski, która chroni podłogę przed wodą i karmą.",
    stockQuantity: 15,
    features: [
      "chroni podłogę",
      "łatwe czyszczenie",
      "prosty wygląd",
    ],
  },
  {
    id: "PWL-TRAVEL-FOLD-BOWL",
    slug: "skladana-miska-silikonowa",
    name: "Składana miska silikonowa",
    price: 39.99,
    purchasePrice: 16.99,
    category: "Spacer i podróż",
    rating: 0,
    reviewCount: 0,
    description: "Składana miska na wodę lub karmę, dobra na spacer i wyjazd.",
    stockQuantity: 1,
    features: [
      "składana konstrukcja",
      "łatwa do opłukania",
      "na spacer, auto i wyjazd",
    ],
  },
  {
    id: "PWL-HOME-MICRO-TOWEL",
    slug: "recznik-z-mikrofibry-dla-pupila",
    name: "Ręcznik z mikrofibry dla pupila",
    price: 39.99,
    purchasePrice: 15.99,
    category: "Dom",
    rating: 0,
    reviewCount: 0,
    description: "Ręcznik z mikrofibry do osuszenia psa lub kota po spacerze i kąpieli.",
    stockQuantity: 7,
    features: [
      "szybko chłonie wilgoć",
      "miękki dla sierści",
      "zajmuje mało miejsca",
    ],
  },
  {
    id: "PWL-TRAVEL-PET-ORGANIZER",
    slug: "organizer-na-akcesoria-pupila",
    name: "Organizer na akcesoria pupila",
    price: 69.99,
    purchasePrice: 29.99,
    category: "Spacer i podróż",
    rating: 0,
    reviewCount: 0,
    description: "Organizer na smycz, woreczki, przysmaki i drobne akcesoria.",
    stockQuantity: 10,
    features: [
      "miejsce na spacerowe akcesoria",
      "łatwy dostęp w domu i aucie",
      "porządek w akcesoriach",
    ],
  },
  {
    id: "PWL-ACC-PET-BANDANA",
    slug: "bandana-dla-psa-lub-kota",
    name: "Bandana dla psa lub kota",
    price: 24.99,
    purchasePrice: 7.99,
    category: "Dla psa",
    rating: 0,
    reviewCount: 0,
    description: "Lekka bandana dla psa lub kota, dobra na spacer i do zdjęć.",
    stockQuantity: 18,
    features: [
      "lekki materiał",
      "prosty sposób zapięcia",
      "na spacer i zdjęcia",
    ],
  },
  {
    id: "PWL-BND-CAT-HOME",
    slug: "zestaw-domowy-dla-kota",
    name: "Zestaw Domowy dla kota",
    price: 119.99,
    purchasePrice: 62.99,
    category: "Dla kota",
    rating: 0,
    reviewCount: 0,
    description: "Mata, ręcznik i organizer w jednym zestawie dla kota.",
    tag: "Nowość",
    stockQuantity: 9,
    features: [
      "mata pod miski",
      "ręcznik z mikrofibry",
      "organizer na drobiazgi",
      "zestaw do domu",
    ],
  },
];

export const bestsellerProducts = products.slice(0, 6);

export const featuredProduct =
  products.find((product) => product.slug === "zestaw-spacer-premium-dla-psa") ??
  products[0];

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductMapOptions = {
  includePurchasePrice?: boolean;
};

function mapProductRow(row: ProductRow, options?: ProductMapOptions): Product {
  const rowImageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
  const imageUrls =
    rowImageUrls.length > 0
      ? rowImageUrls
      : row.image_url
        ? [row.image_url]
        : [];

  const product: Product = {
    id: row.sku,
    slug: row.slug,
    name: row.name,
    price: Number(row.price),
    compareAtPrice:
      row.compare_at_price === null ? undefined : Number(row.compare_at_price),
    category: row.category,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    description: row.description,
    tag: row.tag ?? undefined,
    features: row.features,
    isActive: row.is_active,
    isBundle: row.is_bundle,
    stockQuantity: row.stock_quantity,
    imageUrl: imageUrls[0],
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
  };

  if (options?.includePurchasePrice) {
    product.purchasePrice = Number(row.purchase_price ?? 0);
  }

  return product;
}

function stripPurchasePrice(product: Product): Product {
  const publicProduct = { ...product };

  delete publicProduct.purchasePrice;

  return publicProduct;
}

function getFallbackProducts(includePurchasePrice: boolean) {
  return includePurchasePrice ? products : products.map(stripPurchasePrice);
}

export async function getProductCategories() {
  if (!hasSupabaseBrowserEnv()) {
    return productCategories;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("product_categories")
      .select("name")
      .order("name", { ascending: true });

    if (error || data.length === 0) {
      return productCategories;
    }

    const databaseCategories = data.map((category) => category.name);
    const orderedCategories = productCategories.filter(
      (category) =>
        category === "Wszystkie" || databaseCategories.includes(category),
    );
    const customCategories = databaseCategories.filter(
      (category) => !orderedCategories.includes(category),
    );

    return [...orderedCategories, ...customCategories];
  } catch {
    return productCategories;
  }
}

export async function getPublishedProducts(options?: {
  fallback?: boolean;
  includePurchasePrice?: boolean;
}) {
  const useFallback = options?.fallback ?? true;
  const includePurchasePrice = options?.includePurchasePrice ?? false;

  if (!hasSupabaseBrowserEnv()) {
    return useFallback ? getFallbackProducts(includePurchasePrice) : [];
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      return useFallback ? getFallbackProducts(includePurchasePrice) : [];
    }

    return data.map((row) => mapProductRow(row, { includePurchasePrice }));
  } catch {
    return useFallback ? getFallbackProducts(includePurchasePrice) : [];
  }
}

export async function getAdminProducts() {
  if (!hasSupabaseBrowserEnv()) {
    return products;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return products;
    }

    return data.map((row) => mapProductRow(row, { includePurchasePrice: true }));
  } catch {
    return products;
  }
}

export async function getPublishedProductBySlug(slug: string) {
  const catalog = await getPublishedProducts();

  return catalog.find((product) => product.slug === slug);
}

export async function getBestsellerProducts() {
  const catalog = await getPublishedProducts();

  return catalog.slice(0, 6);
}

export async function getFeaturedProduct() {
  const catalog = await getPublishedProducts();

  return (
    catalog.find(
      (product) => product.slug === "zestaw-spacer-premium-dla-psa",
    ) ?? catalog[0]
  );
}
