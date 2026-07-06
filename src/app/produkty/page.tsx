import type { Metadata } from "next";
import { ProductGrid } from "@/components/ProductGrid";
import { getProductCategories, getPublishedProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Produkty | Pawly",
  description:
    "Praktyczne akcesoria dla psów i kotów do domu, spaceru, auta i podróży.",
};

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    getPublishedProducts(),
    getProductCategories(),
  ]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <ProductGrid products={products} categories={categories} />
    </section>
  );
}
