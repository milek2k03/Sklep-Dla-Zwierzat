import type { Metadata } from "next";
import { ProductGrid } from "@/components/ProductGrid";
import { products } from "@/lib/products";

export const metadata: Metadata = {
  title: "Produkty | Pawly",
  description: "Praktyczne akcesoria dla psów na spacer, do auta i do domu.",
};

export default function ProductsPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <ProductGrid products={products} />
    </section>
  );
}
