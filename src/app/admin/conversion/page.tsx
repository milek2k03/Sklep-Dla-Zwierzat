import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  MousePointerClick,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { ConversionResetButton } from "@/components/admin/ConversionResetButton";
import {
  conversionEventLabels,
  conversionFunnelSteps,
  getConversionEventAmount,
  type ConversionEventType,
} from "@/lib/conversion";
import { storeBrandName } from "@/lib/brand";
import { formatPrice } from "@/lib/format";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const metadata: Metadata = {
  title: `Konwersja admin | ${storeBrandName}`,
};

export const dynamic = "force-dynamic";

type ConversionEventRow =
  Database["public"]["Tables"]["conversion_events"]["Row"];

export default async function AdminConversionPage() {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (adminSession.status !== "admin") {
    redirect("/admin");
  }

  const result = await getConversionEvents();
  const events = result.events;
  const summary = buildConversionSummary(events);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f5a52] transition hover:text-[#1f1f1f]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Wróć do zamówień
            </Link>
            <p className="mt-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#9b6f39]">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Konwersja
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
              Co interesuje klientów
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6d675f]">
              Prosty lejek z ostatnich 30 dni: skąd zaczyna się ruch, które
              produkty są oglądane, co trafia do koszyka i gdzie klienci odpadają
              przed płatnością.
            </p>
          </div>
          <ConversionResetButton />
        </div>
      </div>

      {result.error ? (
        <div className="mt-6 rounded-lg border border-[#f3cbbd] bg-[#fff1e8] p-4 text-sm font-semibold text-[#a64022]">
          Nie udało się pobrać konwersji: {result.error}. Sprawdź, czy migracja
          `030_conversion_events.sql` została uruchomiona w Supabase.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Eye}
          label="Sesje"
          value={String(summary.sessions)}
          hint="Unikalne wizyty w ostatnich 30 dniach"
        />
        <MetricCard
          icon={MousePointerClick}
          label="Dodania do koszyka"
          value={String(summary.addToCart)}
          hint={`${formatPercent(summary.addToCartRate)} z sesji`}
        />
        <MetricCard
          icon={ShoppingCart}
          label="Opłacone zamówienia"
          value={String(summary.paidOrders)}
          hint={`${formatPercent(summary.purchaseRate)} z sesji`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Przychód z lejka"
          value={formatPrice(summary.revenue)}
          hint="Suma zdarzeń opłacenia"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <section className="rounded-lg border border-[#eee7db] bg-white shadow-sm">
          <div className="border-b border-[#eee7db] p-5">
            <h2 className="text-xl font-semibold text-[#1f1f1f]">
              Lejek zakupowy
            </h2>
            <p className="mt-1 text-sm text-[#6d675f]">
              Procent pokazuje przejście z poprzedniego kroku. Największy spadek
              to miejsce do poprawy.
            </p>
          </div>
          <div className="divide-y divide-[#eee7db]">
            {summary.funnel.map((step, index) => (
              <FunnelRow
                key={step.eventType}
                label={step.label}
                count={step.count}
                rate={step.stepRate}
                totalRate={step.totalRate}
                isFirst={index === 0}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#eee7db] bg-white shadow-sm">
          <div className="border-b border-[#eee7db] p-5">
            <h2 className="text-xl font-semibold text-[#1f1f1f]">
              Najciekawsze produkty
            </h2>
            <p className="mt-1 text-sm text-[#6d675f]">
              Produkty z największą liczbą wejść i dodań do koszyka.
            </p>
          </div>
          {summary.topProducts.length === 0 ? (
            <EmptyState text="Nie ma jeszcze danych o produktach." />
          ) : (
            <div className="divide-y divide-[#eee7db]">
              {summary.topProducts.map((product) => (
                <div key={product.key} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1f1f1f]">
                        {product.name}
                      </p>
                      <p className="mt-1 text-xs text-[#8a8177]">
                        {product.category || "Bez kategorii"}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#f5efe5] px-3 py-1 text-xs font-semibold text-[#9b4f1f]">
                      {formatPercent(product.cartRate)}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <MiniStat label="Wyświetlenia" value={product.views} />
                    <MiniStat label="Koszyk" value={product.adds} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-[#eee7db] bg-white shadow-sm">
          <div className="border-b border-[#eee7db] p-5">
            <h2 className="text-xl font-semibold text-[#1f1f1f]">
              Strony startowe
            </h2>
            <p className="mt-1 text-sm text-[#6d675f]">
              Miejsca, na których najczęściej zaczyna się wizyta.
            </p>
          </div>
          {summary.topEntryPages.length === 0 ? (
            <EmptyState text="Brak wejść do pokazania." />
          ) : (
            <div className="divide-y divide-[#eee7db]">
              {summary.topEntryPages.map((page) => (
                <div
                  key={page.path}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1f1f1f]">
                      {page.path}
                    </p>
                    <p className="mt-1 text-xs text-[#8a8177]">
                      {page.title || "Bez tytułu"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[#1f1f1f]">
                    {page.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[#eee7db] bg-white shadow-sm">
          <div className="border-b border-[#eee7db] p-5">
            <h2 className="text-xl font-semibold text-[#1f1f1f]">
              Ostatnie zdarzenia
            </h2>
            <p className="mt-1 text-sm text-[#6d675f]">
              Szybki podgląd tego, co dzieje się teraz.
            </p>
          </div>
          {events.length === 0 ? (
            <EmptyState text="Nie ma jeszcze zdarzeń konwersji." />
          ) : (
            <div className="divide-y divide-[#eee7db]">
              {events.slice(0, 12).map((event) => (
                <div
                  key={event.id}
                  className="grid gap-2 p-5 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center"
                >
                  <p className="text-sm font-semibold text-[#1f1f1f]">
                    {conversionEventLabels[event.event_type]}
                  </p>
                  <p className="min-w-0 truncate text-sm text-[#6d675f]">
                    {event.product_name ||
                      event.order_number ||
                      event.page_path ||
                      "Zdarzenie sklepu"}
                  </p>
                  <p className="text-xs text-[#8a8177]">
                    {formatDateTime(event.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

async function getConversionEvents() {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("conversion_events")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1200);

  return {
    events: (data ?? []) as ConversionEventRow[],
    error: error?.message ?? null,
  };
}

function buildConversionSummary(events: ConversionEventRow[]) {
  const sessions = uniqueCount(events.map((event) => event.session_id));
  const addToCart = countEvents(events, "add_to_cart");
  const paidOrders = countEvents(events, "order_paid");
  const revenue = events.reduce(
    (sum, event) => sum + getConversionEventAmount(event),
    0,
  );
  let previousStepCount = 0;
  const baseCount = Math.max(
    1,
    uniqueSessionCountForEvent(events, "page_view") || sessions,
  );
  const funnel = conversionFunnelSteps.map((step, index) => {
    const count = uniqueSessionCountForEvent(events, step.eventType);
    const stepRate =
      index === 0 ? 1 : previousStepCount > 0 ? count / previousStepCount : 0;
    const totalRate = count / baseCount;
    previousStepCount = count;

    return {
      ...step,
      count,
      stepRate,
      totalRate,
    };
  });

  return {
    sessions,
    addToCart,
    paidOrders,
    revenue,
    addToCartRate: sessions > 0 ? addToCart / sessions : 0,
    purchaseRate: sessions > 0 ? paidOrders / sessions : 0,
    funnel,
    topProducts: buildTopProducts(events),
    topEntryPages: buildTopEntryPages(events),
  };
}

function buildTopProducts(events: ConversionEventRow[]) {
  const products = new Map<
    string,
    {
      key: string;
      name: string;
      category: string | null;
      views: number;
      adds: number;
      cartRate: number;
    }
  >();

  events.forEach((event) => {
    if (!event.product_slug && !event.product_name) {
      return;
    }

    if (event.event_type !== "product_view" && event.event_type !== "add_to_cart") {
      return;
    }

    const key = event.product_slug || event.product_name || event.id;
    const product = products.get(key) ?? {
      key,
      name: event.product_name || event.product_slug || "Produkt",
      category: event.product_category,
      views: 0,
      adds: 0,
      cartRate: 0,
    };

    if (event.event_type === "product_view") {
      product.views += 1;
    }

    if (event.event_type === "add_to_cart") {
      product.adds += 1;
    }

    product.cartRate = product.views > 0 ? product.adds / product.views : 0;
    products.set(key, product);
  });

  return [...products.values()]
    .sort((first, second) => {
      const firstScore = first.views + first.adds * 3;
      const secondScore = second.views + second.adds * 3;
      return secondScore - firstScore;
    })
    .slice(0, 6);
}

function buildTopEntryPages(events: ConversionEventRow[]) {
  const firstPageBySession = new Map<string, ConversionEventRow>();

  [...events]
    .filter((event) => event.event_type === "page_view" && event.page_path)
    .sort(
      (first, second) =>
        new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
    )
    .forEach((event) => {
      if (!firstPageBySession.has(event.session_id)) {
        firstPageBySession.set(event.session_id, event);
      }
    });

  const pages = new Map<
    string,
    { path: string; title: string | null; count: number }
  >();

  firstPageBySession.forEach((event) => {
    const path = event.page_path || "/";
    const page = pages.get(path) ?? {
      path,
      title: event.page_title,
      count: 0,
    };

    page.count += 1;
    pages.set(path, page);
  });

  return [...pages.values()]
    .sort((first, second) => second.count - first.count)
    .slice(0, 8);
}

function MetricCard({
  hint,
  icon: Icon,
  label,
  value,
}: {
  hint: string;
  icon: typeof BarChart3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#6d675f]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
            {value}
          </p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs text-[#8a8177]">{hint}</p>
    </div>
  );
}

function FunnelRow({
  count,
  isFirst,
  label,
  rate,
  totalRate,
}: {
  count: number;
  isFirst: boolean;
  label: string;
  rate: number;
  totalRate: number;
}) {
  const width = `${Math.max(4, Math.min(100, totalRate * 100))}%`;

  return (
    <div className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1f1f1f]">{label}</p>
          <p className="mt-1 text-xs text-[#8a8177]">
            {isFirst ? "Punkt startowy lejka" : `${formatPercent(rate)} z poprzedniego kroku`}
          </p>
        </div>
        <p className="text-2xl font-semibold text-[#1f1f1f]">{count}</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#f3ede3]">
        <div className="h-full rounded-full bg-[#f4a261]" style={{ width }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#faf7f0] px-3 py-2">
      <p className="text-xs text-[#8a8177]">{label}</p>
      <p className="mt-1 font-semibold text-[#1f1f1f]">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
        <ReceiptText className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-semibold text-[#6d675f]">{text}</p>
    </div>
  );
}

function countEvents(events: ConversionEventRow[], eventType: ConversionEventType) {
  return events.filter((event) => event.event_type === eventType).length;
}

function uniqueSessionCountForEvent(
  events: ConversionEventRow[],
  eventType: ConversionEventType,
) {
  return uniqueCount(
    events
      .filter((event) => event.event_type === eventType)
      .map((event) => event.session_id),
  );
}

function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
