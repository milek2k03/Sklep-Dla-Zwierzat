import type { Product } from "@/types/product";
import { productCategories } from "@/lib/product-categories";
import { hasSupabaseBrowserEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export { productCategories };

export const products: Product[] = [
  {
    id: "PWL-BND-SPACER-PREMIUM",
    slug: "zestaw-spacer-premium",
    name: "Zestaw Spacer Premium",
    price: 129.99,
    purchasePrice: 74.99,
    compareAtPrice: 169.99,
    category: "Zestawy",
    rating: 4.9,
    reviewCount: 128,
    description: "Kompletny zestaw na codzienne wyjścia z pupilem.",
    tag: "Bestseller",
    stockQuantity: 12,
    features: [
      "saszetka na smaczki",
      "składana miska",
      "etui na woreczki",
      "wygoda na każdy spacer lub wyjazd",
    ],
  },
  {
    id: "PWL-BND-AUTO-CLEAN",
    slug: "zestaw-czyste-auto",
    name: "Zestaw Czyste Auto",
    price: 149.99,
    purchasePrice: 84.99,
    category: "Auto",
    rating: 4.8,
    reviewCount: 96,
    description: "Zestaw dla osób, które podróżują z pupilem samochodem.",
    stockQuantity: 8,
    features: [
      "pokrowiec do auta",
      "mniej sierści na siedzeniach",
      "łatwiejsze sprzątanie",
    ],
  },
  {
    id: "PWL-ACC-TREAT-POUCH",
    slug: "saszetka-na-smaczki",
    name: "Saszetka na smaczki",
    price: 49.99,
    purchasePrice: 24.99,
    category: "Spacer",
    rating: 4.8,
    reviewCount: 112,
    description: "Praktyczna saszetka na przysmaki podczas spaceru i treningu.",
    stockQuantity: 4,
    features: [
      "lekka i wygodna",
      "szybki dostęp do nagród",
      "sprawdza się na treningu",
    ],
  },
  {
    id: "PWL-ACC-BAG-HOLDER",
    slug: "etui-na-woreczki",
    name: "Etui na woreczki",
    price: 29.99,
    purchasePrice: 9.99,
    category: "Spacer",
    rating: 4.7,
    reviewCount: 89,
    description: "Małe etui, które przypniesz do smyczy lub torby.",
    stockQuantity: 24,
    features: [
      "kompaktowy format",
      "łatwe przypięcie",
      "woreczki zawsze pod ręką",
    ],
  },
  {
    id: "PWL-ACC-FOLD-BOWL",
    slug: "skladana-miska-silikonowa",
    name: "Składana miska silikonowa",
    price: 39.99,
    purchasePrice: 16.99,
    category: "Spacer",
    rating: 4.9,
    reviewCount: 74,
    description: "Lekka miska na wodę lub karmę w podróży.",
    stockQuantity: 1,
    features: [
      "składana konstrukcja",
      "łatwa do opłukania",
      "dobra na dłuższe spacery",
    ],
  },
  {
    id: "PWL-HOME-BOWL-MAT",
    slug: "mata-pod-miski",
    name: "Mata pod miski",
    price: 59.99,
    purchasePrice: 21.99,
    category: "Dom",
    rating: 4.8,
    reviewCount: 64,
    description: "Pomaga utrzymać porządek przy miskach pupila.",
    stockQuantity: 15,
    features: [
      "chroni podloge",
      "łatwe czyszczenie",
      "minimalistyczny wygląd",
    ],
  },
  {
    id: "PWL-HOME-MICRO-TOWEL",
    slug: "recznik-z-mikrofibry",
    name: "Ręcznik z mikrofibry",
    price: 39.99,
    purchasePrice: 15.99,
    category: "Dom",
    rating: 4.6,
    reviewCount: 57,
    description: "Przydatny po spacerze, deszczu lub kąpieli.",
    stockQuantity: 7,
    features: [
      "szybko chlonie wilgoc",
      "miękki dla sierści",
      "zajmuje mało miejsca",
    ],
  },
  {
    id: "PWL-ACC-DOG-BANDANA",
    slug: "bandana-dla-psa",
    name: "Bandana dla pupila",
    price: 24.99,
    purchasePrice: 7.99,
    category: "Spacer",
    rating: 4.7,
    reviewCount: 46,
    description: "Prosty dodatek dla psa lub kota, dobry do zdjęć i spacerów.",
    stockQuantity: 18,
    features: [
      "lekki materiał",
      "prosty sposób zapięcia",
      "subtelny spacerowy dodatek",
    ],
  },
];

export const bestsellerProducts = products.slice(0, 6);

export const featuredProduct =
  products.find((product) => product.slug === "zestaw-spacer-premium") ?? products[0];

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

    return ["Wszystkie", ...data.map((category) => category.name)];
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
    catalog.find((product) => product.slug === "zestaw-spacer-premium") ??
    catalog[0]
  );
}
