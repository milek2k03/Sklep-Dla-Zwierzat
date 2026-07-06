"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { cn } from "@/lib/utils";
import type { Product, ProductCategory } from "@/types/product";

type ProductGridProps = {
  products: Product[];
  categories: Array<"Wszystkie" | ProductCategory>;
  searchQuery?: string;
};

export function ProductGrid({
  products,
  categories,
  searchQuery = "",
}: ProductGridProps) {
  const [activeCategory, setActiveCategory] = useState<
    "Wszystkie" | ProductCategory
  >("Wszystkie");
  const normalizedQuery = normalizeSearchValue(searchQuery);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "Wszystkie" ||
        product.category === activeCategory;
      const searchableContent = normalizeSearchValue(
        [
          product.name,
          product.description,
          product.category,
          product.id,
          product.tag,
          ...product.features,
        ]
          .filter(Boolean)
          .join(" "),
      );
      const matchesQuery =
        normalizedQuery.length === 0 ||
        searchableContent.includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, normalizedQuery, products]);

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
        <div className="text-sm text-[#7a746d] md:text-right">
          <p>{filteredProducts.length} produktów</p>
          {searchQuery ? (
            <p className="mt-1">
              Wyniki dla:{" "}
              <span className="font-semibold text-[#1f1f1f]">
                „{searchQuery}”
              </span>
            </p>
          ) : null}
        </div>
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

      {filteredProducts.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center border-y border-[#eee7db] px-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f4eddf] text-[#b65320]">
            <Search className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-xl font-semibold text-[#1f1f1f]">
            Nie znaleziono produktów
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#7a746d]">
            Zmień wyszukiwaną frazę lub wybierz inną kategorię.
          </p>
          {searchQuery ? (
            <Link
              href="/produkty"
              className="mt-5 text-sm font-semibold text-[#b65320] underline decoration-[#d8b7a1] underline-offset-4"
            >
              Wyczyść wyszukiwanie
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
