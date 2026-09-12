import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPublishedProducts } from "@/lib/products";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const MAX_SUGGESTIONS = 6;

export async function GET(request: NextRequest) {
  const rateLimit = await checkRateLimit(`product-search:${getClientIp(request)}`, {
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { suggestions: [] },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter ?? 60),
        },
      },
    );
  }

  const query = request.nextUrl.searchParams
    .get("q")
    ?.trim()
    .slice(0, MAX_QUERY_LENGTH);

  if (!query || query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  const normalizedQuery = normalizeSearchValue(query);
  const products = await getPublishedProducts();
  const suggestions = products
    .filter((product) =>
      normalizeSearchValue(
        [
          product.name,
          product.category,
          product.id,
          product.description,
          product.tag,
          ...product.features,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(normalizedQuery),
    )
    .sort((firstProduct, secondProduct) => {
      const firstStartsWithQuery = normalizeSearchValue(
        firstProduct.name,
      ).startsWith(normalizedQuery);
      const secondStartsWithQuery = normalizeSearchValue(
        secondProduct.name,
      ).startsWith(normalizedQuery);

      return Number(secondStartsWithQuery) - Number(firstStartsWithQuery);
    })
    .slice(0, MAX_SUGGESTIONS)
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category,
      price: product.price,
    }));

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        "Cache-Control": "private, max-age=15",
      },
    },
  );
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}
