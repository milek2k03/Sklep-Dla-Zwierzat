import type { Metadata } from "next";
import { ProductGrid } from "@/components/ProductGrid";
import { storeBrandName } from "@/lib/brand";
import { getProductCategories, getPublishedProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: `Produkty | ${storeBrandName}`,
  description:
    "Praktyczne akcesoria dla psów i kotów do domu, spaceru, auta i podróży.",
};

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const [products, categories, resolvedSearchParams] = await Promise.all([
    getPublishedProducts(),
    getProductCategories(),
    searchParams,
  ]);
  const query = normalizeSearchQuery(resolvedSearchParams.q);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <ProductGrid
        key={query}
        products={products}
        categories={categories}
        searchQuery={query}
      />
    </section>
  );
}

function normalizeSearchQuery(value: string | string[] | undefined) {
  const query = Array.isArray(value) ? value[0] : value;

  return query?.trim().slice(0, 100) ?? "";
}
