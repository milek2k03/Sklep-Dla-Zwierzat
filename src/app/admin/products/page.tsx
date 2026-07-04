import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Boxes, FileSpreadsheet, PackagePlus, Pencil, Save, Search } from "lucide-react";
import {
  createCategoryAction,
  createProductAction,
  deleteProductAction,
  importProductsAction,
  updateProductAction,
} from "@/app/admin/products/actions";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { ProductImageInput } from "@/components/admin/ProductImageInput";
import { SanitizedNumberInput } from "@/components/admin/SanitizedNumberInput";
import { formatPrice } from "@/lib/format";
import { getAdminProducts, getProductCategories } from "@/lib/products";
import { getAdminSession } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

export const metadata: Metadata = {
  title: "Produkty admin | Pawly",
};

export const dynamic = "force-dynamic";

type AdminProductsPageProps = {
  searchParams: Promise<{
    edit?: string | string[];
    error?: string | string[];
    category?: string | string[];
    q?: string | string[];
    saved?: string | string[];
  }>;
};

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (adminSession.status !== "admin") {
    redirect("/admin");
  }

  const [allProducts, categories, resolvedSearchParams] = await Promise.all([
    getAdminProducts(),
    getProductCategories(),
    searchParams,
  ]);
  const error = getFirstSearchParam(resolvedSearchParams.error);
  const saved = getFirstSearchParam(resolvedSearchParams.saved);
  const editSku = getFirstSearchParam(resolvedSearchParams.edit);
  const query = getFirstSearchParam(resolvedSearchParams.q)?.trim() ?? "";
  const categoryFilter = getFirstSearchParam(resolvedSearchParams.category) ?? "";
  const products = filterProducts(allProducts, query, categoryFilter);
  const editedProduct = allProducts.find((product) => product.id === editSku);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f5a52] transition hover:text-[#1f1f1f]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Wróć do zamówień
            </Link>
            <p className="mt-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#2f6b3f]">
              <Boxes className="h-4 w-4" aria-hidden="true" />
              Katalog
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
              Produkty Pawly
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6d675f]">
              Produkty są w bazie Supabase. ID generuje baza automatycznie.
            </p>
          </div>
          <div className="rounded-lg bg-[#1f1f1f] px-4 py-3 text-white">
            <p className="text-xs text-white/62">Produkty</p>
            <p className="text-xl font-semibold">{allProducts.length}</p>
          </div>
        </div>
      </div>

      {saved ? (
        <div className="mt-6 rounded-lg border border-[#cfe8d2] bg-[#ecf8ee] p-4 text-sm font-semibold text-[#2f6b3f]">
          Zapisano zmiany w katalogu.
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f3cbbd] bg-[#fff1e8] p-4 text-sm font-semibold text-[#a64022]">
          Nie udało się zapisać produktu: {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
              {editedProduct ? (
                <Pencil className="h-5 w-5" aria-hidden="true" />
              ) : (
                <PackagePlus className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 className="text-xl font-semibold text-[#1f1f1f]">
                {editedProduct ? "Edytuj produkt" : "Nowy produkt"}
              </h2>
              <p className="mt-1 text-sm text-[#6d675f]">
                {editedProduct
                  ? editedProduct.id
                  : "ID zostanie wygenerowane automatycznie."}
              </p>
            </div>
          </div>
          <ProductForm
            key={editedProduct?.id ?? "new-product"}
            action={editedProduct ? updateProductAction : createProductAction}
            categories={categories}
            product={editedProduct}
            submitLabel={editedProduct ? "Zapisz zmiany" : "Dodaj produkt"}
          />
        </aside>

        <div className="overflow-hidden rounded-lg border border-[#eee7db] bg-white shadow-sm">
          <div className="border-b border-[#eee7db] p-4 sm:p-5">
            <h2 className="text-xl font-semibold text-[#1f1f1f]">Lista produktów</h2>
            <p className="mt-1 text-sm text-[#6d675f]">
              Przy większym katalogu edytujesz tylko jeden produkt naraz.
            </p>

            <form action="/admin/products" className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a746d]"
                  aria-hidden="true"
                />
                <input
                  name="q"
                  className="field-input min-h-11 py-2.5 pl-10"
                  defaultValue={query}
                  placeholder="Szukaj po ID, nazwie albo slug..."
                />
              </div>
              <select
                name="category"
                className="field-input min-h-11 py-2.5"
                defaultValue={categoryFilter}
              >
                <option value="">Wszystkie kategorie</option>
                {categories
                  .filter((category) => category !== "Wszystkie")
                  .map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
              >
                Filtruj
              </button>
              <Link
                href="/admin/products"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
              >
                Wyczyść
              </Link>
            </form>
          </div>

          <div className="divide-y divide-[#eee7db]">
            {products.map((product) => {
              const isEdited = editedProduct?.id === product.id;
              const purchasePrice = product.purchasePrice ?? 0;

              return (
                <article
                  key={product.id}
                  className={cn(
                    "grid gap-4 p-4 transition sm:grid-cols-[minmax(0,1fr)_140px_120px_auto] sm:items-center sm:p-5",
                    isEdited ? "bg-[#fff7e8] ring-1 ring-inset ring-[#d7b477]" : "bg-white",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-[#1f1f1f]">
                        {product.name}
                      </h3>
                      {isEdited ? (
                        <span className="rounded-full bg-[#1f1f1f] px-3 py-1 text-xs font-semibold text-white">
                          Edytowany
                        </span>
                      ) : null}
                      <span className="rounded-full bg-[#f7f1e8] px-3 py-1 text-xs font-semibold text-[#6d675f]">
                        {product.category}
                      </span>
                      {product.isActive === false ? (
                        <span className="rounded-full bg-[#fff1e8] px-3 py-1 text-xs font-semibold text-[#a64022]">
                          Ukryty
                        </span>
                      ) : null}
                      {product.isBundle ? (
                        <span className="rounded-full bg-[#e8f4ea] px-3 py-1 text-xs font-semibold text-[#2f6b3f]">
                          Zestaw
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-sm text-[#6d675f]">
                      {product.id} • /produkt/{product.slug}
                    </p>
                  </div>

                  <div className="text-sm">
                    <p className="font-semibold text-[#1f1f1f]">
                      {formatPrice(product.price)}
                    </p>
                    <p className="mt-1 text-xs text-[#6d675f]">
                      Zakup: {formatPrice(purchasePrice)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#2f6b3f]">
                      Zysk: {formatPrice(product.price - purchasePrice)}
                    </p>
                    {product.compareAtPrice ? (
                      <p className="mt-1 text-xs text-[#8a8177] line-through">
                        {formatPrice(product.compareAtPrice)}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8a8177]">
                      Stan
                    </p>
                    <p className="mt-1 font-semibold text-[#1f1f1f]">
                      {product.stockQuantity ?? 0}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Link
                      href={`/admin/products?edit=${encodeURIComponent(product.id)}`}
                      scroll={false}
                      className={cn(
                        "inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition",
                        isEdited
                          ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                          : "border-[#d7cab9] text-[#1f1f1f] hover:border-[#1f1f1f]",
                      )}
                    >
                      Edytuj
                    </Link>
                    <Link
                      href={`/produkt/${product.slug}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#1f1f1f] px-4 text-sm font-semibold text-white transition hover:bg-[#34302d]"
                    >
                      Podgląd
                    </Link>
                    <form action={deleteProductAction}>
                      <input type="hidden" name="sku" value={product.id} />
                      <DeleteProductButton productName={product.name} />
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form
          action={createCategoryAction}
          className="rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-[#1f1f1f]">
            Nowa kategoria
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              name="categoryName"
              className="field-input"
              placeholder="np. Karma"
              required
            />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
            >
              Dodaj
            </button>
          </div>
        </form>

        <form
          action={importProductsAction}
          className="rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-[#b65320]" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-[#1f1f1f]">
              Import z CSV
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#6d675f]">
            Wyeksportuj arkusz z Excela jako CSV UTF-8. Kolumny: name/nazwa,
            price/cena, purchase_price/cena_zakupu, category/kategoria,
            stock/stan, opcjonalnie sku, slug, image_url, description/opis,
            features/cechy.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              name="productsFile"
              type="file"
              accept=".csv,text/csv"
              className="field-input"
              required
            />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
            >
              Importuj
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function ProductForm({
  action,
  categories,
  product,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  categories: Array<"Wszystkie" | string>;
  product?: Product;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4">
      {product ? (
        <>
          <input type="hidden" name="originalSku" value={product.id} />
          <input type="hidden" name="sku" value={product.id} />
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Slug URL">
          <input
            name="slug"
            className="field-input"
            defaultValue={product?.slug ?? ""}
            placeholder="nowy-produkt"
          />
        </Field>
        <Field label="Kategoria">
          <select
            name="category"
            className="field-input"
            defaultValue={product?.category ?? "Dla psa"}
          >
            {categories
              .filter((category) => category !== "Wszystkie")
              .map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
          </select>
        </Field>
      </div>

      <Field label="Nazwa">
        <input
          name="name"
          className="field-input"
          defaultValue={product?.name ?? ""}
          required
        />
      </Field>

      {(product?.imageUrls ?? []).map((imageUrl) => (
        <input
          key={imageUrl}
          type="hidden"
          name="existingImageUrls"
          value={imageUrl}
        />
      ))}

      <Field label="Zdjęcia produktu (WebP, maks. 5)">
        {product?.imageUrls?.length ? (
          <div className="mb-3 grid grid-cols-5 gap-2">
            {product.imageUrls.slice(0, 5).map((imageUrl, index) => (
              <div
                key={imageUrl}
                className="relative aspect-square overflow-hidden rounded-lg border border-[#eee7db] bg-[#f7f1e8]"
              >
                <Image
                  src={imageUrl}
                  alt={`${product.name} - zdjęcie ${index + 1}`}
                  fill
                  sizes="72px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
        <ProductImageInput
          name="images"
          className="field-input"
        />
        <span className="mt-2 block text-xs leading-5 text-[#6d675f]">
          Wgranie nowych plików zastąpi obecną galerię. Maks. 5 plików WebP,
          do 2 MB każdy. Bez wyboru plików obecne zdjęcia zostają.
        </span>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Cena">
          <SanitizedNumberInput
            name="price"
            numberMode="float"
            className="field-input"
            defaultValue={product?.price ?? ""}
            required
          />
        </Field>
        <Field label="Cena zakupu">
          <SanitizedNumberInput
            name="purchasePrice"
            numberMode="float"
            className="field-input"
            defaultValue={product?.purchasePrice ?? ""}
            required
          />
        </Field>
        <Field label="Stan magazynowy">
          <SanitizedNumberInput
            name="stockQuantity"
            numberMode="int"
            className="field-input"
            defaultValue={product?.stockQuantity ?? 0}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cena przekreślona">
          <SanitizedNumberInput
            name="compareAtPrice"
            numberMode="float"
            className="field-input"
            defaultValue={product?.compareAtPrice ?? ""}
          />
        </Field>
        <Field label="Tag">
          <input
            name="tag"
            className="field-input"
            defaultValue={product?.tag ?? ""}
            placeholder="Bestseller"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ocena">
          <SanitizedNumberInput
            name="rating"
            numberMode="float"
            className="field-input"
            defaultValue={product?.rating ?? 0}
          />
        </Field>
        <Field label="Liczba opinii">
          <SanitizedNumberInput
            name="reviewCount"
            numberMode="int"
            className="field-input"
            defaultValue={product?.reviewCount ?? 0}
          />
        </Field>
      </div>

      <Field label="Opis">
        <textarea
          name="description"
          className="field-input min-h-24 resize-y"
          defaultValue={product?.description ?? ""}
          required
        />
      </Field>

      <Field label="Cechy produktu, każda w osobnej linii">
        <textarea
          name="features"
          className="field-input min-h-24 resize-y"
          defaultValue={product?.features.join("\n") ?? ""}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-lg bg-[#f7f1e8] px-4 py-3 text-sm font-semibold text-[#1f1f1f]">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={product?.isActive ?? true}
            className="accent-[#1f1f1f]"
          />
          Aktywny w sklepie
        </label>
        <label className="flex items-center gap-3 rounded-lg bg-[#f7f1e8] px-4 py-3 text-sm font-semibold text-[#1f1f1f]">
          <input
            name="isBundle"
            type="checkbox"
            defaultChecked={product?.isBundle ?? false}
            className="accent-[#1f1f1f]"
          />
          To jest zestaw
        </label>
      </div>

      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {submitLabel}
      </button>
      <button
        type="reset"
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
      >
        Reset
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#1f1f1f]">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function filterProducts(products: Product[], query: string, category: string) {
  const normalizedQuery = query.toLowerCase();

  return products.filter((product) => {
    const matchesCategory = !category || product.category === category;
    const matchesQuery =
      !normalizedQuery ||
      product.id.toLowerCase().includes(normalizedQuery) ||
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.slug.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });
}
