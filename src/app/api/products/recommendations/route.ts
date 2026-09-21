import { NextResponse, type NextRequest } from "next/server";
import { getAvailableStock } from "@/lib/inventory";
import { getPublishedProducts } from "@/lib/products";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Product } from "@/types/product";

const MAX_RECOMMENDATIONS = 6;
const MAX_CART_PRODUCTS = 50;

function words(value: string) {
  return value.toLocaleLowerCase("pl").normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .match(/[\p{Letter}]{4,}/gu) ?? [];
}

function petMatch(product: Product, cart: Product[]) {
  const name = `${product.name} ${product.category}`.toLocaleLowerCase("pl");
  const cartNames = cart.map((item) => `${item.name} ${item.category}`.toLocaleLowerCase("pl"));
  const cartHasDog = cartNames.some((value) => /psa|pies|dla psa/.test(value));
  const cartHasCat = cartNames.some((value) => /kota|kot|dla kota/.test(value));
  if (cartHasDog && !cartHasCat && /dla kota/.test(name)) return -20;
  if (cartHasCat && !cartHasDog && /dla psa/.test(name)) return -20;
  return 0;
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  const rateLimit = await checkRateLimit(`product-recommendations:${clientIp}`, {
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ products: [] }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ products: [] }, { status: 400 });
  }

  const slugs = (body as { slugs?: unknown })?.slugs;
  if (!Array.isArray(slugs) || slugs.length === 0 || slugs.length > MAX_CART_PRODUCTS ||
    !slugs.every((slug) => typeof slug === "string" && slug.length <= 160)) {
    return NextResponse.json({ products: [] }, { status: 400 });
  }

  const catalog = await getPublishedProducts();
  const cartSlugs = new Set(slugs);
  const cart = catalog.filter((product) => cartSlugs.has(product.slug));
  const cartWords = new Set(cart.flatMap((product) => words(`${product.name} ${product.description} ${product.features.join(" ")}`)));

  const products = catalog
    .filter((product) => !cartSlugs.has(product.slug) && getAvailableStock(product) > 0)
    .map((product, index) => ({
      product,
      index,
      score: petMatch(product, cart) +
        (cart.some((item) => item.category === product.category) ? 8 : 0) +
        words(`${product.name} ${product.description} ${product.features.join(" ")}`)
          .filter((word) => cartWords.has(word)).length,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ product }) => product);

  return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
}
