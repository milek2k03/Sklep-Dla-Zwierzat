"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { cn } from "@/lib/utils";
import type { Product, ProductCategory } from "@/types/product";

type ProductGridProps = {
  products: Product[];
  categories: Array<"Wszystkie" | ProductCategory>;
};

export function ProductGrid({ products, categories }: ProductGridProps) {
  const [activeCategory, setActiveCategory] = useState<
    "Wszystkie" | ProductCategory
  >("Wszystkie");

  const filteredProducts = useMemo(() => {
    if (activeCategory === "Wszystkie") {
      return products;
    }

    return products.filter((product) => product.category === activeCategory);
  }, [activeCategory, products]);

  return (
    <div>
      <div className="mb-8 overflow-hidden rounded-lg border border-[#eee7db] bg-white shadow-sm">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
              Produkty
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f] sm:text-4xl">
              Akcesoria Pawly
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#6d675f]">
              Przejrzysty wybór produktów dla psów i kotów: do domu, na spacer,
              do auta i w podróż.
            </p>
          </div>
          <div className="rounded-lg bg-[#1f1f1f] p-5 text-white">
            <p className="text-sm font-semibold text-[#ffd9c2]">
              Darmowa dostawa
            </p>
            <p className="mt-2 text-2xl font-semibold">od 199 zł</p>
            <p className="mt-2 text-sm leading-6 text-white/68">
              Najlepiej działa przy zestawach i zakupach łączonych.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1f1f1f]">Katalog</h2>
          <p className="mt-1 text-sm text-[#7a746d]">
            Wybierz kategorię i dodaj produkt bez opuszczania listy.
          </p>
        </div>
        <p className="text-sm text-[#7a746d]">
          {filteredProducts.length} produktów
        </p>
      </div>

      <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition",
              activeCategory === category
                ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                : "border-[#e7dfd2] bg-white text-[#5f5a52] hover:border-[#1f1f1f]",
            )}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {filteredProducts.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}
