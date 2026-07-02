import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgePercent, Pencil, Trash2 } from "lucide-react";
import {
  createDiscountAction,
  deleteDiscountAction,
  updateDiscountAction,
} from "@/app/admin/discounts/actions";
import { DiscountForm } from "@/components/admin/DiscountForm";
import {
  discountTimeModeLabels,
  weekdayLabels,
  type DiscountCodeRow,
} from "@/lib/discounts";
import { getAdminProducts, getProductCategories } from "@/lib/products";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Product } from "@/types/product";

export const metadata: Metadata = {
  title: "Rabaty admin | Pawly",
};

export const dynamic = "force-dynamic";

type AdminDiscountsPageProps = {
  searchParams: Promise<{
    edit?: string | string[];
    error?: string | string[];
    saved?: string | string[];
  }>;
};

export default async function AdminDiscountsPage({
  searchParams,
}: AdminDiscountsPageProps) {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (adminSession.status !== "admin") {
    redirect("/admin");
  }

  const [discounts, products, categories, resolvedSearchParams] = await Promise.all([
    getDiscounts(),
    getAdminProducts(),
    getProductCategories(),
    searchParams,
  ]);
  const editId = getFirstSearchParam(resolvedSearchParams.edit);
  const editedDiscount = discounts.find((discount) => discount.id === editId);
  const error = getFirstSearchParam(resolvedSearchParams.error);
  const saved = getFirstSearchParam(resolvedSearchParams.saved);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm sm:p-7">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f5a52] transition hover:text-[#1f1f1f]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Wróć do zamówień
        </Link>
        <p className="mt-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#2f6b3f]">
          <BadgePercent className="h-4 w-4" aria-hidden="true" />
          Promocje
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
          Kody rabatowe
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#6d675f]">
          Dodaj kod stały, ograniczony czasowo albo cykliczny i ustaw zniżkę od
          0 do 100%.
        </p>
      </div>

      {saved ? (
        <div className="mt-6 rounded-lg border border-[#cfe8d2] bg-[#ecf8ee] p-4 text-sm font-semibold text-[#2f6b3f]">
          Zapisano kod rabatowy.
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f3cbbd] bg-[#fff1e8] p-4 text-sm font-semibold text-[#a64022]">
          Nie udało się zapisać kodu: {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[430px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
              {editedDiscount ? (
                <Pencil className="h-5 w-5" aria-hidden="true" />
              ) : (
                <BadgePercent className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 className="text-xl font-semibold text-[#1f1f1f]">
                {editedDiscount ? "Edytuj kod" : "Nowy kod"}
              </h2>
              <p className="mt-1 text-sm text-[#6d675f]">
                Kod zostanie zapisany wielkimi literami.
              </p>
            </div>
          </div>

          <DiscountForm
            action={editedDiscount ? updateDiscountAction : createDiscountAction}
            categories={categories}
            discount={editedDiscount}
            products={products}
            submitLabel={editedDiscount ? "Zapisz zmiany" : "Dodaj kod"}
          />
        </aside>

        <div className="overflow-hidden rounded-lg border border-[#eee7db] bg-white shadow-sm">
          <div className="border-b border-[#eee7db] p-4 sm:p-5">
            <h2 className="text-xl font-semibold text-[#1f1f1f]">
              Aktywne i zapisane kody
            </h2>
            <p className="mt-1 text-sm text-[#6d675f]">
              Zakres może obejmować cały sklep, kolekcję albo pojedynczy produkt.
            </p>
          </div>

          <div className="divide-y divide-[#eee7db]">
            {discounts.length === 0 ? (
              <div className="p-6 text-sm text-[#6d675f]">
                Nie ma jeszcze kodów rabatowych.
              </div>
            ) : (
              discounts.map((discount) => (
                <article
                  key={discount.id}
                  className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_150px_150px_auto] sm:items-center sm:p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-[#1f1f1f]">
                        {discount.code}
                      </h3>
                      <span className="rounded-full bg-[#f7f1e8] px-3 py-1 text-xs font-semibold text-[#6d675f]">
                        {discount.percent}%
                      </span>
                      {!discount.is_active ? (
                        <span className="rounded-full bg-[#fff1e8] px-3 py-1 text-xs font-semibold text-[#a64022]">
                          Wyłączony
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-[#6d675f]">
                      {formatScope(discount, products)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#1f1f1f]">
                    {discountTimeModeLabels[discount.time_mode]}
                  </p>
                  <p className="text-sm text-[#6d675f]">
                    {formatTime(discount)}
                  </p>
                  <div className="flex gap-2 sm:justify-end">
                    <Link
                      href={`/admin/discounts?edit=${discount.id}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d7cab9] px-4 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
                    >
                      Edytuj
                    </Link>
                    <form action={deleteDiscountAction}>
                      <input type="hidden" name="id" value={discount.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#f3cbbd] px-4 text-sm font-semibold text-[#a64022] transition hover:bg-[#fff1e8]"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

async function getDiscounts() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return data;
}

function formatScope(discount: DiscountCodeRow, products: Product[]) {
  if (discount.scope_type === "all") {
    return "Cały sklep";
  }

  if (discount.scope_type === "category") {
    return `Kolekcja: ${discount.scope_value}`;
  }

  const product = products.find((item) => item.id === discount.scope_value);

  return `Produkt: ${product?.name ?? discount.scope_value}`;
}

function formatTime(discount: DiscountCodeRow) {
  if (discount.time_mode === "permanent") {
    return "Bez limitu czasu";
  }

  if (discount.time_mode === "scheduled") {
    return `${formatDate(discount.starts_at)} - ${formatDate(discount.ends_at)}`;
  }

  return discount.weekdays
    .map((weekday) => weekdayLabels.find((item) => item.value === weekday)?.label)
    .filter(Boolean)
    .join(", ");
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pl-PL") : "-";
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
