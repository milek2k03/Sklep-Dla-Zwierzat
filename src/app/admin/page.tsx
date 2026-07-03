import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  Clock3,
  FileSpreadsheet,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { AdminOrderStatusSelect } from "@/components/admin/AdminOrderStatusSelect";
import { AdminRefundButton } from "@/components/admin/AdminRefundButton";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { deliveryOptions } from "@/lib/delivery";
import { formatPrice } from "@/lib/format";
import {
  isOrderStatus,
  orderStatusLabels,
  orderStatuses,
  type OrderStatus,
} from "@/lib/order-status";
import { getProductBySlug } from "@/lib/products";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const metadata: Metadata = {
  title: "Panel admina | Pawly",
};

export const dynamic = "force-dynamic";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items: Database["public"]["Tables"]["order_items"]["Row"][];
  order_events: Database["public"]["Tables"]["order_events"]["Row"][];
};
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type OrderEventRow = Database["public"]["Tables"]["order_events"]["Row"] & {
  orders: Pick<Database["public"]["Tables"]["orders"]["Row"], "order_number"> | null;
};

type AdminPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (adminSession.status === "unconfigured") {
    return (
      <AdminNotice
        title="Supabase nie jest skonfigurowany"
        text="Ustaw NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY oraz SUPABASE_SECRET_KEY w .env.local, a potem uruchom migrację SQL."
      />
    );
  }

  if (adminSession.status === "forbidden") {
    return (
      <AdminNotice
        title="Brak dostępu do panelu"
        text="Jesteś zalogowany, ale Twoje konto nie ma roli admina w tabeli admin_profiles."
      />
    );
  }

  const resolvedSearchParams = await searchParams;
  const orderSearch = normalizeOrderSearch(resolvedSearchParams.q);
  const statusFilter = normalizeOrderStatus(resolvedSearchParams.status);
  const hasFilters = Boolean(orderSearch || statusFilter);
  const supabase = await createSupabaseServerClient();
  let ordersQuery = supabase
    .from("orders")
    .select("*, order_items(*), order_events(*)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (orderSearch) {
    ordersQuery = ordersQuery.ilike("order_number", `%${orderSearch}%`);
  }

  if (statusFilter) {
    ordersQuery = ordersQuery.eq("status", statusFilter);
  }

  const [statusCounts, dashboard, ordersResult] = await Promise.all([
    getStatusCounts(orderSearch),
    getAdminDashboardData(),
    ordersQuery,
  ]);
  const { data, error } = ordersResult;
  const orders = (data ?? []) as OrderRow[];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#2f6b3f]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Dostęp chroniony
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
              Zamówienia Pawly
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6d675f]">
              Zalogowano jako {adminSession.email ?? "admin"}. Widok korzysta z
              RLS i serwerowej weryfikacji roli.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[460px]">
            <Link
              href="/admin/discounts"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
            >
              Rabaty
            </Link>
            <Link
              href="/admin/products"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
            >
              Produkty
            </Link>
            <Link
              href="/admin/returns"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
            >
              Zwroty
            </Link>
            <Link
              href="/admin/expenses"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
            >
              <ReceiptText className="h-4 w-4" aria-hidden="true" />
              Koszty
            </Link>
            <Link
              href="/api/admin/sales-ledger/export"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Sprzedaż CSV
            </Link>
            <Link
              href="/api/admin/expenses/export"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Koszty CSV
            </Link>
            <div className="sm:col-span-2">
              <AdminSignOutButton />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f3cbbd] bg-[#fff1e8] p-5 text-sm text-[#a64022]">
          Nie udało się pobrać zamówień. Sprawdź migrację SQL i polityki RLS.
        </div>
      ) : null}

      <AdminDashboard dashboard={dashboard} statusCounts={statusCounts} />

      <section className="mt-6 rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#9b6f39]">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Ewidencja sprzedaży
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1f1f1f]">
              Eksport CSV
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6d675f]">
              Pobierz arkusz z opłaconymi zamówieniami, produktami, kosztami
              dostawy, zwrotami i sumą narastającą. Plik otworzysz w Excelu albo
              Google Sheets.
            </p>
          </div>
          <form
            action="/api/admin/sales-ledger/export"
            className="grid gap-3 sm:grid-cols-[150px_150px_auto]"
          >
            <label className="block text-sm font-semibold text-[#1f1f1f]">
              Od
              <input
                className="field-input mt-2 min-h-10 py-2"
                name="from"
                type="date"
              />
            </label>
            <label className="block text-sm font-semibold text-[#1f1f1f]">
              Do
              <input
                className="field-input mt-2 min-h-10 py-2"
                name="to"
                type="date"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Pobierz CSV
            </button>
          </form>
        </div>
      </section>

      <div className="mt-6 overflow-x-auto rounded-lg border border-[#eee7db] bg-white p-3 shadow-sm">
        <div className="flex min-w-max gap-2">
          <StatusFilterLink
            href={buildAdminHref({ q: orderSearch })}
            isActive={!statusFilter}
            label="Wszystkie"
            count={statusCounts.all}
          />
          {orderStatuses.map((status) => (
            <StatusFilterLink
              key={status}
              href={buildAdminHref({ q: orderSearch, status })}
              isActive={statusFilter === status}
              label={orderStatusLabels[status]}
              count={statusCounts[status]}
              status={status}
            />
          ))}
        </div>
      </div>

      <form
        action="/admin"
        className="mt-6 rounded-lg border border-[#eee7db] bg-white p-4 shadow-sm"
      >
        {statusFilter ? (
          <input type="hidden" name="status" value={statusFilter} />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <label className="block">
            <span className="text-sm font-semibold text-[#1f1f1f]">
              Numer zamówienia
            </span>
            <span className="relative mt-2 block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a746d]"
                aria-hidden="true"
              />
              <input
                id="admin-order-search"
                name="q"
                type="search"
                defaultValue={orderSearch}
                placeholder="np. PAWLY-MJ..."
                className="field-input min-h-11 py-2.5 pl-10"
              />
            </span>
          </label>

          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
          >
            <Search
              className="h-4 w-4"
              aria-hidden="true"
            />
            Filtruj
          </button>
          {hasFilters ? (
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Wyczyść
            </Link>
          ) : null}
        </div>
        {hasFilters ? (
          <p className="mt-3 text-sm text-[#6d675f]">
            Aktywne filtry:{" "}
            <span className="font-semibold text-[#1f1f1f]">
              {formatActiveFilters(orderSearch, statusFilter)}
            </span>
          </p>
        ) : null}
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-[#eee7db] bg-white shadow-sm">
        {orders.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
              <PackageCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[#1f1f1f]">
              {hasFilters ? "Nie znaleziono zamówień" : "Brak zamówień"}
            </h2>
            <p className="mt-2 text-sm text-[#6d675f]">
              {hasFilters
                ? "Zmień filtry lub wyczyść wyszukiwanie."
                : "Gdy klient złoży zamówienie przez checkout, pojawi się tutaj."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#eee7db]">
            {orders.map((order) => {
              const latestEvent = getLatestOrderEvent(order.order_events);

              return (
                <article key={order.id} className="p-4 sm:p-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,1fr)_160px_170px] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-[#1f1f1f]">
                          {order.order_number}
                        </h2>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f1e8] px-3 py-1 text-xs font-semibold text-[#6d675f]">
                          <span
                            className={[
                              "h-2.5 w-2.5 rounded-full",
                              getStatusDotClassName(order.status),
                            ].join(" ")}
                            aria-hidden="true"
                          />
                          {orderStatusLabels[order.status]}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-medium text-[#1f1f1f]">
                        {order.customer_full_name}
                      </p>
                      <p className="mt-1 truncate text-sm text-[#6d675f]">
                        {order.customer_email} • {order.customer_phone}
                      </p>
                      <p className="mt-1 text-xs text-[#7a746d]">
                        {new Date(order.created_at).toLocaleString("pl-PL")}
                      </p>
                    </div>

                    <div className="min-w-0 rounded-lg bg-[#fffdf8] px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8a8177]">
                        Produkty
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-[#1f1f1f]">
                        {formatOrderItemsPreview(order.order_items)}
                      </p>
                      {latestEvent ? (
                        <p className="mt-2 truncate text-xs text-[#7a746d]">
                          Ostatnio: {formatOrderEvent(latestEvent)}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-lg bg-[#1f1f1f] px-4 py-3 text-white xl:text-right">
                      <p className="text-xs text-white/62">Razem</p>
                      <p className="mt-1 text-xl font-semibold">
                        {formatPrice(Number(order.total))}
                      </p>
                      {Number(order.discount_total) > 0 ? (
                        <p className="mt-1 text-xs text-white/68">
                          Rabat: -{formatPrice(Number(order.discount_total))}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-sm text-[#6d675f] xl:text-right">
                      <p className="font-semibold text-[#1f1f1f]">
                        {order.shipping_carrier ?? getAdminDeliveryName(order.delivery_method)}
                      </p>
                      {order.tracking_number ? (
                        <p className="mt-1">
                          {order.tracking_url ? (
                            <a
                              href={order.tracking_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-[#1f1f1f] underline-offset-4 hover:underline"
                            >
                              {order.tracking_number}
                            </a>
                          ) : (
                            <span className="font-semibold text-[#1f1f1f]">
                              {order.tracking_number}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-[#8a8177]">
                          Brak trackingu
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[380px_minmax(0,1fr)]">
                    <details className="group rounded-lg border border-[#eee7db] bg-white">
                      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#1f1f1f] marker:hidden">
                        Obsługa zamówienia
                        <span className="ml-2 text-xs font-medium text-[#7a746d]">
                          status, tracking, zwrot
                        </span>
                      </summary>
                      <div className="border-t border-[#eee7db] p-4">
                        <AdminOrderStatusSelect
                          orderId={order.id}
                          status={order.status}
                          shippingCarrier={order.shipping_carrier}
                          trackingNumber={order.tracking_number}
                          trackingUrl={order.tracking_url}
                        />
                        {order.status === "paid" &&
                        order.payment_method === "stripe" &&
                        order.stripe_payment_intent_id &&
                        !order.stripe_refund_id ? (
                          <AdminRefundButton
                            orderId={order.id}
                            orderNumber={order.order_number}
                          />
                        ) : null}
                        {order.status === "paid" || order.status === "shipped" ? (
                          <Link
                            href={`/admin/returns?order=${order.id}`}
                            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-[#d7cab9] bg-white px-4 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
                          >
                            Zwrot / reklamacja
                          </Link>
                        ) : null}
                      </div>
                    </details>

                    <details className="group rounded-lg border border-[#eee7db] bg-white">
                      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#1f1f1f] marker:hidden">
                        Szczegóły
                        <span className="ml-2 text-xs font-medium text-[#7a746d]">
                          produkty, dostawa, historia
                        </span>
                      </summary>
                      <div className="grid gap-4 border-t border-[#eee7db] p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-lg bg-[#fffdf8] p-4">
                          <p className="text-sm font-semibold text-[#1f1f1f]">
                            Produkty
                          </p>
                          <div className="mt-3 space-y-2">
                            {order.order_items.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between gap-3 text-sm text-[#6d675f]"
                              >
                                <span className="min-w-0">
                                  <span className="block text-[#1f1f1f]">
                                    {item.product_name} × {item.quantity}
                                  </span>
                                  <span className="mt-1 block text-xs">
                                    ID: {getOrderItemProductId(item.product_slug)}
                                  </span>
                                </span>
                                <span className="font-semibold text-[#1f1f1f]">
                                  {formatPrice(Number(item.line_total))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg bg-[#fffdf8] p-4 text-sm text-[#6d675f]">
                          <p className="font-semibold text-[#1f1f1f]">Dostawa</p>
                          <p className="mt-2">
                            {getAdminDeliveryName(order.delivery_method)}
                          </p>
                          <p className="mt-1">{order.delivery_address}</p>
                          {order.pickup_point ? (
                            <p className="mt-1">Punkt: {order.pickup_point}</p>
                          ) : null}
                          {order.shipping_carrier || order.tracking_number ? (
                            <div className="mt-3 border-t border-[#eee7db] pt-3">
                              <p>
                                Przewoźnik:{" "}
                                <span className="font-semibold text-[#1f1f1f]">
                                  {order.shipping_carrier ?? "-"}
                                </span>
                              </p>
                              <p className="mt-1">
                                Tracking:{" "}
                                {order.tracking_url ? (
                                  <a
                                    href={order.tracking_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-[#1f1f1f] underline-offset-4 hover:underline"
                                  >
                                    {order.tracking_number ?? order.tracking_url}
                                  </a>
                                ) : (
                                  <span className="font-semibold text-[#1f1f1f]">
                                    {order.tracking_number ?? "-"}
                                  </span>
                                )}
                              </p>
                              {order.shipped_at ? (
                                <p className="mt-1">
                                  Wysłano:{" "}
                                  {new Date(order.shipped_at).toLocaleString("pl-PL")}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {order.discount_code ? (
                            <p className="mt-3 border-t border-[#eee7db] pt-3">
                              Kod rabatowy:{" "}
                              <span className="font-semibold text-[#1f1f1f]">
                                {order.discount_code}
                              </span>
                            </p>
                          ) : null}
                          {order.stripe_refund_id ? (
                            <div className="mt-3 border-t border-[#eee7db] pt-3">
                              <p>
                                Zwrot Stripe:{" "}
                                <span className="font-semibold text-[#1f1f1f]">
                                  {order.stripe_refund_id}
                                </span>
                              </p>
                              {order.refunded_at ? (
                                <p className="mt-1">
                                  Zwrócono:{" "}
                                  {new Date(order.refunded_at).toLocaleString(
                                    "pl-PL",
                                  )}
                                </p>
                              ) : null}
                              {order.refund_reason ? (
                                <p className="mt-1">Powód: {order.refund_reason}</p>
                              ) : null}
                            </div>
                          ) : null}
                          {order.notes ? (
                            <p className="mt-3 border-t border-[#eee7db] pt-3">
                              {order.notes}
                            </p>
                          ) : null}
                        </div>

                        {order.order_events.length > 0 ? (
                          <div className="rounded-lg bg-[#fffdf8] p-4 text-sm xl:col-span-2">
                            <p className="font-semibold text-[#1f1f1f]">
                              Historia
                            </p>
                            <div className="mt-3 grid gap-2 lg:grid-cols-2">
                              {getSortedOrderEvents(order.order_events)
                                .slice(0, 8)
                                .map((event) => (
                                  <div
                                    key={event.id}
                                    className="rounded-lg border border-[#eee7db] bg-white p-3"
                                  >
                                    <p className="font-medium text-[#1f1f1f]">
                                      {formatOrderEvent(event)}
                                    </p>
                                    <p className="mt-1 text-xs text-[#7a746d]">
                                      {new Date(event.created_at).toLocaleString(
                                        "pl-PL",
                                      )}{" "}
                                      • {formatEventActor(event.actor_type)}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function AdminDashboard({
  dashboard,
  statusCounts,
}: {
  dashboard: Awaited<ReturnType<typeof getAdminDashboardData>>;
  statusCounts: Record<OrderStatus, number> & { all: number };
}) {
  const cards = [
    {
      href: "/admin?status=new",
      icon: Clock3,
      label: "Nowe zamówienia",
      value: statusCounts.new,
      hint: "Wymagają pierwszej obsługi",
    },
    {
      href: "/admin?status=paid",
      icon: Truck,
      label: "Do wysłania",
      value: statusCounts.paid,
      hint: "Opłacone, jeszcze niewysłane",
    },
    {
      href: "/admin?status=shipped",
      icon: PackageCheck,
      label: "Wysłane",
      value: statusCounts.shipped,
      hint: "Paczki przekazane przewoźnikowi",
    },
    {
      href: "/admin/returns",
      icon: RotateCcw,
      label: "Sprawy posprzedażowe",
      value: dashboard.openReturnCasesCount,
      hint: "Zwroty, reklamacje i wymiany",
    },
    {
      href: "/admin/products",
      icon: Boxes,
      label: "Niski stan",
      value: dashboard.lowStockProducts.length,
      hint: "Aktywne produkty poniżej 5 szt.",
    },
  ];

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              className="rounded-lg border border-[#eee7db] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d7cab9]"
              href={card.href}
              key={card.label}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5efe5] text-[#1f1f1f]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-2xl font-semibold text-[#1f1f1f]">
                  {card.value}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#1f1f1f]">
                {card.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#6d675f]">{card.hint}</p>
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#eee7db] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1f1f1f]">
              Niski stan magazynowy
            </p>
            <p className="mt-1 text-xs text-[#6d675f]">
              Aktywne produkty z mniej niż 5 sztukami.
            </p>
          </div>
          <Link
            href="/admin/products"
            className="text-sm font-semibold text-[#1f1f1f] underline-offset-4 hover:underline"
          >
            Produkty
          </Link>
        </div>
        {dashboard.lowStockProducts.length > 0 ? (
          <div className="mt-4 space-y-2">
            {dashboard.lowStockProducts.map((product) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg bg-[#fffdf8] px-3 py-2 text-sm"
                key={product.sku}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#1f1f1f]">
                    {product.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#6d675f]">
                    ID: {product.sku}
                  </span>
                </span>
                <span className="rounded-full bg-[#fff1e8] px-3 py-1 text-xs font-semibold text-[#a64022]">
                  {product.stock_quantity} szt.
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-[#f0faf2] p-3 text-sm text-[#2f6b3f]">
            Brak produktów z niskim stanem.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[#eee7db] bg-white p-4 shadow-sm xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1f1f1f]">
              Ostatnie zdarzenia
            </p>
            <p className="mt-1 text-xs text-[#6d675f]">
              Płatności, wysyłki, e-maile, zwroty i reklamacje.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#6d675f]">
            {dashboard.recentEvents.length} ostatnich
          </span>
        </div>
        {dashboard.recentEvents.length > 0 ? (
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {dashboard.recentEvents.map((event) => (
              <div
                className="rounded-lg bg-[#fffdf8] px-3 py-3 text-sm"
                key={event.id}
              >
                <p className="font-semibold text-[#1f1f1f]">
                  {formatOrderEvent(event)}
                </p>
                <p className="mt-1 text-xs text-[#6d675f]">
                  {event.orders?.order_number ?? "Zamówienie"} •{" "}
                  {new Date(event.created_at).toLocaleString("pl-PL")} •{" "}
                  {formatEventActor(event.actor_type)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-[#fffdf8] p-3 text-sm text-[#6d675f]">
            Brak zdarzeń do pokazania.
          </p>
        )}
      </div>
    </div>
  );
}

function normalizeOrderSearch(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue?.trim().slice(0, 80) ?? "";
}

function normalizeOrderStatus(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return isOrderStatus(rawValue) ? rawValue : null;
}

function formatActiveFilters(
  orderSearch: string,
  statusFilter: OrderStatus | null,
) {
  return [
    orderSearch ? `numer "${orderSearch}"` : null,
    statusFilter ? `status "${orderStatusLabels[statusFilter]}"` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildAdminHref({
  q,
  status,
}: {
  q?: string;
  status?: OrderStatus;
}) {
  const params = new URLSearchParams();

  if (q) {
    params.set("q", q);
  }

  if (status) {
    params.set("status", status);
  }

  const queryString = params.toString();

  return queryString ? `/admin?${queryString}` : "/admin";
}

async function getStatusCounts(orderSearch: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("orders").select("status");

  if (orderSearch) {
    query = query.ilike("order_number", `%${orderSearch}%`);
  }

  const { data } = await query;
  const rows = (data ?? []) as Pick<
    Database["public"]["Tables"]["orders"]["Row"],
    "status"
  >[];
  const counts = orderStatuses.reduce(
    (acc, status) => ({
      ...acc,
      [status]: 0,
    }),
    { all: rows.length } as Record<OrderStatus, number> & { all: number },
  );

  rows.forEach((row) => {
    counts[row.status] += 1;
  });

  return counts;
}

async function getAdminDashboardData() {
  const supabase = await createSupabaseServerClient();
  const [openReturnCasesResult, lowStockResult, recentEventsResult] =
    await Promise.all([
      supabase
        .from("return_cases")
        .select("id", { count: "exact", head: true })
        .neq("status", "closed"),
      supabase
        .from("products")
        .select("sku, name, stock_quantity")
        .eq("is_active", true)
        .lt("stock_quantity", 5)
        .order("stock_quantity", { ascending: true })
        .order("name", { ascending: true })
        .limit(8),
      supabase
        .from("order_events")
        .select("*, orders(order_number)")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return {
    openReturnCasesCount: openReturnCasesResult.count ?? 0,
    lowStockProducts: (lowStockResult.data ?? []) as Pick<
      ProductRow,
      "sku" | "name" | "stock_quantity"
    >[],
    recentEvents: (recentEventsResult.data ?? []) as OrderEventRow[],
  };
}

function StatusFilterLink({
  count,
  href,
  isActive,
  label,
  status,
}: {
  count: number;
  href: string;
  isActive: boolean;
  label: string;
  status?: OrderStatus;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={[
        "inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition",
        isActive
          ? "border-[#d7b477] bg-[#e9c991] text-[#1f1f1f]"
          : "border-[#eee7db] bg-[#fffdf8] text-[#5f5a52] hover:border-[#d7cab9] hover:text-[#1f1f1f]",
      ].join(" ")}
    >
      {status ? (
        <span
          className={[
            "h-3 w-3 rounded-full",
            getStatusDotClassName(status),
          ].join(" ")}
          aria-hidden="true"
        />
      ) : null}
      <span>{label}</span>
      <span className={isActive ? "text-[#1f1f1f]" : "text-[#8a8177]"}>
        {count}
      </span>
    </Link>
  );
}

function getStatusDotClassName(status: OrderStatus) {
  const dotClassNames: Record<OrderStatus, string> = {
    new: "bg-[#f6b84b]",
    confirmed: "bg-[#2fbf7a]",
    paid: "bg-[#3f82f6]",
    shipped: "bg-[#8c7cf0]",
    cancelled: "bg-[#df4a5b]",
  };

  return dotClassNames[status];
}

function getOrderItemProductId(slug: string) {
  return getProductBySlug(slug)?.id ?? slug;
}

function getAdminDeliveryName(deliveryMethod: string) {
  return (
    deliveryOptions.find((option) => option.id === deliveryMethod)?.name ??
    deliveryMethod
  );
}

function formatOrderItemsPreview(
  items: Database["public"]["Tables"]["order_items"]["Row"][],
) {
  if (items.length === 0) {
    return "Brak produktów";
  }

  return items.map((item) => `${item.product_name} × ${item.quantity}`).join(" • ");
}

function getLatestOrderEvent(
  events: Database["public"]["Tables"]["order_events"]["Row"][],
) {
  return getSortedOrderEvents(events)[0] ?? null;
}

function getSortedOrderEvents(
  events: Database["public"]["Tables"]["order_events"]["Row"][],
) {
  return [...events].sort(
    (firstEvent, secondEvent) =>
      new Date(secondEvent.created_at).getTime() -
      new Date(firstEvent.created_at).getTime(),
  );
}

function formatOrderEvent(
  event: Database["public"]["Tables"]["order_events"]["Row"],
) {
  if (event.message) {
    return event.message;
  }

  if (event.from_status && event.to_status) {
    return `${orderStatusLabels[event.from_status]} -> ${
      orderStatusLabels[event.to_status]
    }`;
  }

  const eventLabels: Record<
    Database["public"]["Tables"]["order_events"]["Row"]["event_type"],
    string
  > = {
    status_changed: "Zmieniono status",
    payment_paid: "Płatność potwierdzona",
    payment_failed: "Płatność nieudana",
    checkout_expired: "Checkout wygasł",
    stock_restored: "Przywrócono magazyn",
    tracking_updated: "Zaktualizowano tracking",
    email_sent: "Wysłano e-mail",
    refund_created: "Zlecono zwrot",
    return_case_created: "Utworzono sprawę",
    return_case_updated: "Zaktualizowano sprawę",
    return_case_closed: "Zamknięto sprawę",
  };

  return eventLabels[event.event_type];
}

function formatEventActor(
  actorType: Database["public"]["Tables"]["order_events"]["Row"]["actor_type"],
) {
  const actorLabels: Record<typeof actorType, string> = {
    admin: "admin",
    stripe: "Stripe",
    system: "system",
  };

  return actorLabels[actorType];
}

function AdminNotice({ title, text }: { title: string; text: string }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-[#f3cbbd] bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1e8] text-[#a64022]">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-[#1f1f1f]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#6d675f]">{text}</p>
      </div>
    </section>
  );
}
