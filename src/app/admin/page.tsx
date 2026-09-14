import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Eye,
  FileSpreadsheet,
  PackageCheck,
  PackageX,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { AdminOrderStatusSelect } from "@/components/admin/AdminOrderStatusSelect";
import { AdminRefundButton } from "@/components/admin/AdminRefundButton";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { storeBrandName } from "@/lib/brand";
import { deliveryOptions, getShippingCarrierForDeliveryMethod } from "@/lib/delivery";
import { formatPrice } from "@/lib/format";
import {
  isOrderStatus,
  orderStatusLabels,
  orderStatuses,
  type OrderStatus,
} from "@/lib/order-status";
import { expireUnpaidOrders } from "@/lib/orders/expire-unpaid";
import { getProductBySlug } from "@/lib/products";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const metadata: Metadata = {
  title: `Panel admina | ${storeBrandName}`,
};

export const dynamic = "force-dynamic";

const unregisteredActivityQuarterlyLimit2026 = 10813.5;
const limitWarningRatio = 0.8;
const ordersPerPage = 5;
const ordersControlsAnchor = "admin-orders-controls";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items: Database["public"]["Tables"]["order_items"]["Row"][];
  order_events: Database["public"]["Tables"]["order_events"]["Row"][];
};
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type OrderEventRow = Database["public"]["Tables"]["order_events"]["Row"] & {
  orders: Pick<Database["public"]["Tables"]["orders"]["Row"], "order_number"> | null;
};
type ReturnCaseRow = Database["public"]["Tables"]["return_cases"]["Row"];
type ReturnCaseItemRow = Database["public"]["Tables"]["return_case_items"]["Row"];
type FinancialOrderItemRow = Pick<
  OrderItemRow,
  "line_total" | "purchase_total" | "quantity" | "unit_purchase_price"
>;
type FinancialOrderRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "created_at"
  | "delivery_cost"
  | "discount_total"
  | "id"
  | "paid_at"
  | "refund_delivery_total"
  | "refund_total"
  | "refunded_at"
  | "status"
  | "stripe_refund_id"
  | "subtotal"
  | "total"
  | "updated_at"
> & {
  order_items: FinancialOrderItemRow[];
};
type FinancialReturnCaseItemRow = Pick<
  ReturnCaseItemRow,
  "quantity" | "return_condition"
> & {
  order_items: Pick<
    OrderItemRow,
    "purchase_total" | "quantity" | "unit_purchase_price"
  > | null;
};
type FinancialReturnCaseRow = Pick<
  ReturnCaseRow,
  | "approved_refund_amount"
  | "approved_delivery_refund_amount"
  | "created_at"
  | "order_id"
  | "refunded_at"
  | "updated_at"
> & {
  return_case_items: FinancialReturnCaseItemRow[];
};
type DashboardCustomerReturn = {
  amount: number;
  date: string;
  orderId: string;
};

type AdminPageProps = {
  searchParams: Promise<{
    page?: string | string[];
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
  const currentPage = normalizePage(resolvedSearchParams.page);
  const ordersFrom = (currentPage - 1) * ordersPerPage;
  const ordersTo = ordersFrom + ordersPerPage - 1;
  const hasFilters = Boolean(orderSearch || statusFilter);
  await expireUnpaidOrders();
  const supabase = await createSupabaseServerClient();
  let ordersQuery = supabase
    .from("orders")
    .select("*, order_items(*), order_events(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(ordersFrom, ordersTo);

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
  const { data, error, count } = ordersResult;
  const orders = (data ?? []) as OrderRow[];
  const totalOrders = count ?? orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / ordersPerPage));
  const pageStart = totalOrders > 0 ? ordersFrom + 1 : 0;
  const pageEnd = totalOrders > 0 ? Math.min(ordersFrom + orders.length, totalOrders) : 0;

  if (!error && totalOrders > 0 && currentPage > totalPages) {
    redirect(
      buildAdminHref({
        page: totalPages,
        q: orderSearch,
        status: statusFilter ?? undefined,
      }),
    );
  }

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
              Zamówienia {storeBrandName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6d675f]">
              Zalogowano jako {adminSession.email ?? "admin"}. Widok korzysta z
              RLS i serwerowej weryfikacji roli.
            </p>
          </div>
          <div className="hidden">
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
              Pobierz prostą ewidencję przychodu: każde zamówienie, produkty,
              dostawa pobrana od klienta, status, forma płatności i kwota
              narastająco. Plik otworzysz w Excelu albo Google Sheets.
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

      <div
        className="mt-6 scroll-mt-6 overflow-x-auto rounded-lg border border-[#eee7db] bg-white p-3 shadow-sm"
        id={ordersControlsAnchor}
      >
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
                        {order.shipping_carrier ??
                          getShippingCarrierForDeliveryMethod(order.delivery_method) ??
                          getAdminDeliveryName(order.delivery_method)}
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
                    <details className="group overflow-hidden rounded-lg border border-transparent bg-transparent">
                      <AdminDetailsSummary
                        actionLabel="Otwórz obsługę"
                        description="Status, tracking, zwrot"
                        icon={ClipboardCheck}
                        title="Obsługa zamówienia"
                        variant="primary"
                      />
                      <div className="rounded-b-lg border border-t-0 border-[#eee7db] bg-white p-4">
                        <AdminOrderStatusSelect
                          deliveryMethod={order.delivery_method}
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
                            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-[#d7cab9] bg-white px-4 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#f4a261] hover:bg-[#fff7e8] focus:outline-none focus:ring-2 focus:ring-[#f4a261]/40"
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            Zwrot / reklamacja
                          </Link>
                        ) : null}
                      </div>
                    </details>

                    <details className="group overflow-hidden rounded-lg border border-transparent bg-transparent">
                      <AdminDetailsSummary
                        actionLabel="Otwórz szczegóły"
                        description="Produkty, dostawa, historia"
                        icon={Eye}
                        title="Szczegóły"
                        variant="secondary"
                      />
                      <div className="grid gap-4 rounded-b-lg border border-t-0 border-[#eee7db] bg-white p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                                  <span className="mt-1 block text-xs text-[#7a746d]">
                                    Zakup: {formatPrice(getOrderItemPurchaseTotal(item))}{" "}
                                    • Zysk: {formatPrice(getOrderItemProfit(item))}
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
                            <ol className="mt-3 grid gap-2 lg:grid-cols-2">
                              {getChronologicalOrderEvents(order.order_events).map(
                                (event, eventIndex) => (
                                  <li
                                    key={event.id}
                                    className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-lg border border-[#eee7db] bg-white p-3"
                                  >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4a261] text-sm font-semibold text-[#11151b]">
                                      {eventIndex + 1}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block font-medium text-[#1f1f1f]">
                                        {formatOrderEvent(event)}
                                      </span>
                                      <span className="mt-1 block text-xs text-[#7a746d]">
                                        {new Date(event.created_at).toLocaleString(
                                          "pl-PL",
                                        )}{" "}
                                        • {formatEventActor(event.actor_type)}
                                      </span>
                                    </span>
                                  </li>
                                ),
                              )}
                            </ol>
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

      {totalPages > 1 ? (
        <AdminOrdersPagination
          currentPage={currentPage}
          pageEnd={pageEnd}
          pageStart={pageStart}
          q={orderSearch}
          status={statusFilter}
          totalOrders={totalOrders}
          totalPages={totalPages}
        />
      ) : null}
    </section>
  );
}

function AdminDetailsSummary({
  actionLabel,
  description,
  icon: Icon,
  title,
  variant,
}: {
  actionLabel: string;
  description: string;
  icon: LucideIcon;
  title: string;
  variant: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <summary
      className={[
        "flex min-h-[76px] cursor-pointer list-none select-none items-center justify-between gap-4 rounded-lg border-2 px-4 py-3 text-left shadow-lg transition hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#11151b] group-open:rounded-b-none marker:hidden [&::-webkit-details-marker]:hidden",
        isPrimary
          ? "border-[#ffb06f] bg-[#f4a261] text-[#11151b] shadow-[0_16px_34px_rgba(244,162,97,0.28)] hover:bg-[#ffb06f] focus:ring-[#f4a261]/60 group-open:bg-[#ffb06f]"
          : "border-[#344252] bg-[#151b22] text-white shadow-[0_16px_34px_rgba(0,0,0,0.28)] hover:border-[#f4a261] hover:bg-[#1b232d] focus:ring-[#f4a261]/50 group-open:border-[#f4a261] group-open:bg-[#111820] group-open:text-white group-open:shadow-[0_0_0_1px_rgba(244,162,97,0.35),0_18px_38px_rgba(0,0,0,0.32)]",
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1",
            isPrimary
              ? "bg-[#11151b] text-white ring-[#11151b]"
              : "bg-[#f4a261] text-[#11151b] ring-[#f4a261]",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold leading-5">
            {title}
          </span>
          <span
            className={[
              "mt-1.5 block text-sm font-semibold leading-5",
              isPrimary ? "text-[#4b2f18]" : "text-[#b8c7d9] group-open:text-[#f4c28e]",
            ].join(" ")}
          >
            {description}
          </span>
        </span>
      </span>
      <span
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#11151b] px-4 text-sm font-semibold text-white shadow-sm transition"
      >
        <span className="group-open:hidden">{actionLabel}</span>
        <span className="hidden group-open:inline">Zamknij</span>
        <ChevronDown
          className="h-4 w-4 transition group-open:rotate-180"
          aria-hidden="true"
        />
      </span>
    </summary>
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
  const tasks = [
    {
      href: "/admin?status=paid",
      label: "Spakuj i wyślij opłacone zamówienia",
      value: statusCounts.paid,
      hint: "Najważniejsze, bo klient już zapłacił.",
      tone: "urgent",
    },
    {
      href: "/admin?status=new",
      label: "Sprawdź nowe zamówienia",
      value: statusCounts.new,
      hint: "Oczekują na płatność albo pierwszą obsługę.",
      tone: "neutral",
    },
    {
      href: "/admin/returns",
      label: "Obsłuż zwroty i reklamacje",
      value: dashboard.openReturnCasesCount,
      hint: "Otwarte sprawy posprzedażowe.",
      tone: "neutral",
    },
    {
      href: "/admin/products",
      label: "Uzupełnij niski stan magazynowy",
      value: dashboard.lowStockProducts.length,
      hint: "Aktywne produkty poniżej 5 sztuk.",
      tone: "neutral",
    },
    {
      href: "/admin?status=new",
      label: "Sprawdź zaległe płatności Stripe",
      value: dashboard.staleUnpaidOrdersCount,
      hint: "Nieopłacone dłużej niż 15 minut. Cron powinien je anulować.",
      tone: dashboard.staleUnpaidOrdersCount > 0 ? "urgent" : "ok",
    },
  ];
  const activeTasks = tasks.filter((task) => task.value > 0);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="overflow-hidden rounded-lg border border-[#244a34] bg-[#111817] p-5 text-white shadow-sm ring-1 ring-[#62e89c]/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7ff0a6]">
                Wynik sprzedaży
              </p>
              <h2 className="mt-2 text-base font-semibold text-white">
                Czysty zysk z transakcji
              </h2>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
                {formatPrice(dashboard.financials.netProfit)}
              </p>
              <p className="mt-2 text-sm font-medium text-[#b7c9c0]">
                Cena sprzedaży minus cena zakupu
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#2f6b3f] bg-[#173323] text-[#8df2b2]">
              <TrendingUp className="h-6 w-6" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8ea69a]">
                Sprzedaż
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatPrice(dashboard.financials.salesTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8ea69a]">
                Koszt zakupu
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatPrice(dashboard.financials.purchaseCostTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8ea69a]">
                Transakcje
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {dashboard.financials.transactionCount}
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-lg border border-[#244a34] bg-[#0d1412] p-3 text-xs leading-5 text-[#c6d7ce]">
            Suma z zamówień opłaconych i wysłanych. Nie miesza się z refundami,
            żeby wynik sprzedaży i straty były widoczne osobno.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#55302d] bg-[#191313] p-5 text-white shadow-sm ring-1 ring-[#ff9b85]/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#ffb09b]">
                Koszty po zwrotach
              </p>
              <h2 className="mt-2 text-base font-semibold text-white">
                Straty łącznie
              </h2>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
                {formatPrice(dashboard.financials.totalLoss)}
              </p>
              <p className="mt-2 text-sm font-medium text-[#d5b7ae]">
                Refundy klientom plus towar poza sprzedażą
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#7a3a32] bg-[#331d1b] text-[#ffb09b]">
              <PackageX className="h-6 w-6" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#bfa098]">
                Zwroty klientom
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatPrice(dashboard.financials.customerRefundLoss)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#bfa098]">
                Towar poza sprzedażą
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatPrice(dashboard.financials.inventoryLoss)}
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-lg border border-[#55302d] bg-[#120e0e] p-3 text-xs leading-5 text-[#e2c7bf]">
            Towar nienadający się do sprzedaży jest liczony po cenie zakupu.
            Refundy są liczone oddzielnie od straty magazynowej.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#594b2b] bg-[#181610] p-5 text-white shadow-sm ring-1 ring-[#f0c36a]/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#f0c36a]">
                Limit działalności nierejestrowanej
              </p>
              <h2 className="mt-2 text-base font-semibold text-white">
                Bieżący kwartał
              </h2>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
                {formatPrice(dashboard.unregisteredActivity.quarterRevenue)}
              </p>
              <p className="mt-2 text-sm font-medium text-[#d8c69a]">
                Limit: {formatPrice(dashboard.unregisteredActivity.quarterLimit)}
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#80662f] bg-[#332817] text-[#f0c36a]">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#c8b987]">
                Ten miesiąc
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatPrice(dashboard.unregisteredActivity.monthRevenue)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#c8b987]">
                Wykorzystanie
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {dashboard.unregisteredActivity.usagePercent}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#c8b987]">
                Zostało
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatPrice(dashboard.unregisteredActivity.remaining)}
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-lg border border-[#594b2b] bg-[#11100c] p-3 text-xs leading-5 text-[#e3d3a7]">
            {dashboard.unregisteredActivity.warning}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <FinancialReportExportForm
          action="/api/admin/financial-report/export"
          buttonLabel="Pobierz szczegółowy CSV"
          description="Pełny eksport: podsumowanie, pozycje zamówień, koszty zakupu, marże, refundy oraz straty magazynowe."
          title="Raport szczegółowy do Excela"
          variant="detail"
        />
        <FinancialReportExportForm
          action="/api/admin/financial-report/pit/export"
          buttonLabel="Pobierz ewidencję CSV"
          description="Ewidencja działalności nierejestrowanej: sprzedaż, zwroty klientów, koszty, korekty kosztów, limit i finalne liczby do PIT-36."
          title="Ewidencja działalności nierejestrowanej"
          variant="pit"
        />
      </div>

      <div className="rounded-lg border border-[#26313c] bg-[#111820] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Do zrobienia</p>
            <p className="mt-1 text-xs leading-5 text-[#9fb1bd]">
              Krótka lista rzeczy, które najczęściej blokują obsługę sklepu.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-[#cbd6df]">
            {activeTasks.length === 0
              ? "Brak pilnych zadań"
              : `${activeTasks.length} aktywne`}
          </span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {tasks.map((task) => (
            <Link
              className={[
                "rounded-lg border p-3 transition hover:-translate-y-0.5",
                task.value > 0 && task.tone === "urgent"
                  ? "border-[#ff9b85]/50 bg-[#331d1b] text-white"
                  : task.value > 0
                    ? "border-[#f0c36a]/40 bg-[#2b2517] text-white"
                    : "border-white/10 bg-black/20 text-[#cbd6df]",
              ].join(" ")}
              href={task.href}
              key={task.label}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{task.label}</p>
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-sm font-semibold",
                    task.value > 0 && task.tone === "urgent"
                      ? "bg-[#ff9b85] text-[#1a0d0a]"
                      : task.value > 0
                        ? "bg-[#f0c36a] text-[#181610]"
                        : "bg-white/10 text-[#cbd6df]",
                  ].join(" ")}
                >
                  {task.value}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#9fb1bd]">
                {task.hint}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
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
    </div>
  );
}

function FinancialReportExportForm({
  action,
  buttonLabel,
  description,
  title,
  variant,
}: {
  action: string;
  buttonLabel: string;
  description: string;
  title: string;
  variant: "detail" | "pit";
}) {
  const isPit = variant === "pit";
  const iconClassName = isPit ? "text-[#ffb09b]" : "text-[#7ff0a6]";
  const focusClassName = isPit ? "focus:border-[#ffb09b]" : "focus:border-[#7ff0a6]";
  const buttonClassName = isPit
    ? "bg-[#ffb09b] text-[#1a0d0a] hover:bg-[#ffc4b4]"
    : "bg-[#7ff0a6] text-[#07110b] hover:bg-[#9bf5ba]";

  return (
    <form
      action={action}
      className="rounded-lg border border-[#26313c] bg-[#111820] p-4 shadow-sm"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_150px_150px]">
        <div className="lg:col-span-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileSpreadsheet className={`h-4 w-4 ${iconClassName}`} aria-hidden="true" />
            {title}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#9fb1bd]">
            {description}
          </p>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#9fb1bd]">
          Od
          <input
            className={`mt-2 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-white outline-none [color-scheme:dark] ${focusClassName}`}
            name="from"
            type="date"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#9fb1bd]">
          Do
          <input
            className={`mt-2 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-white outline-none [color-scheme:dark] ${focusClassName}`}
            name="to"
            type="date"
          />
        </label>
        <button
          type="submit"
          className={`inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-lg px-4 text-sm font-semibold transition ${buttonClassName}`}
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          {buttonLabel}
        </button>
      </div>
    </form>
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

function normalizePage(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const page = Number(rawValue);

  return Number.isInteger(page) && page > 0 ? page : 1;
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
  page,
  q,
  status,
}: {
  page?: number;
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

  if (page && page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString ? `/admin?${queryString}` : "/admin";
}

function buildAdminOrdersPageHref({
  page,
  q,
  status,
}: {
  page?: number;
  q?: string;
  status?: OrderStatus;
}) {
  return `${buildAdminHref({ page, q, status })}#${ordersControlsAnchor}`;
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
  const unpaidOrderCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const [
    openReturnCasesResult,
    lowStockResult,
    recentEventsResult,
    financialOrdersResult,
    returnLossResult,
    staleUnpaidOrdersResult,
  ] =
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
      supabase
        .from("orders")
        .select("id, status, created_at, paid_at, subtotal, discount_total, delivery_cost, total, refund_total, refund_delivery_total, stripe_refund_id, refunded_at, updated_at, order_items(line_total, purchase_total, quantity, unit_purchase_price)"),
      supabase
        .from("return_cases")
        .select("order_id, approved_refund_amount, approved_delivery_refund_amount, created_at, updated_at, refunded_at, return_case_items(quantity, return_condition, order_items(purchase_total, quantity, unit_purchase_price))"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "confirmed"])
        .eq("payment_method", "stripe")
        .is("stock_restored_at", null)
        .lte("created_at", unpaidOrderCutoff),
    ]);
  const financialOrders = (financialOrdersResult.data ?? []) as FinancialOrderRow[];
  const returnCases = (returnLossResult.data ?? []) as FinancialReturnCaseRow[];

  return {
    financials: getFinancialDashboardSummary(financialOrders, returnCases),
    unregisteredActivity: getUnregisteredActivityDashboardSummary(
      financialOrders,
      returnCases,
    ),
    openReturnCasesCount: openReturnCasesResult.count ?? 0,
    staleUnpaidOrdersCount: staleUnpaidOrdersResult.count ?? 0,
    lowStockProducts: (lowStockResult.data ?? []) as Pick<
      ProductRow,
      "sku" | "name" | "stock_quantity"
    >[],
    recentEvents: (recentEventsResult.data ?? []) as OrderEventRow[],
  };
}

function getFinancialDashboardSummary(
  orders: FinancialOrderRow[],
  returnCases: FinancialReturnCaseRow[],
) {
  const profitOrders = orders.filter((order) =>
    ["paid", "shipped"].includes(order.status),
  );
  const salesTotal = money(
    profitOrders.reduce((total, order) => {
      return (
        total +
        order.order_items.reduce(
          (itemsTotal, item) => itemsTotal + Number(item.line_total),
          0,
        )
      );
    }, 0),
  );
  const purchaseCostTotal = money(
    profitOrders.reduce((total, order) => {
      return (
        total +
        order.order_items.reduce(
          (itemsTotal, item) => itemsTotal + getOrderItemPurchaseTotal(item),
          0,
        )
      );
    }, 0),
  );
  const customerRefundLoss = money(
    returnCases.reduce(
      (total, returnCase) => total + Number(returnCase.approved_refund_amount),
      0,
    ),
  );
  const inventoryLoss = money(
    returnCases.reduce((total, returnCase) => {
      return (
        total +
        returnCase.return_case_items
          .filter((item) => item.return_condition === "unsellable")
          .reduce(
            (itemsTotal, item) => itemsTotal + getReturnItemPurchaseLoss(item),
            0,
          )
      );
    }, 0),
  );

  return {
    customerRefundLoss,
    inventoryLoss,
    netProfit: money(salesTotal - purchaseCostTotal),
    purchaseCostTotal,
    salesTotal,
    totalLoss: money(customerRefundLoss + inventoryLoss),
    transactionCount: profitOrders.length,
  };
}

function getUnregisteredActivityDashboardSummary(
  orders: FinancialOrderRow[],
  returnCases: FinancialReturnCaseRow[],
) {
  const customerReturns = getDashboardCustomerReturns(orders, returnCases);
  const today = getWarsawDateKey(new Date());
  const currentMonth = today.slice(0, 7);
  const currentQuarter = getDatePeriod(`${today}T00:00:00.000Z`, "quarter");
  const monthRevenue =
    getDashboardPeriodNetRevenueBuckets(orders, customerReturns, "month").get(
      currentMonth,
    ) ?? 0;
  const quarterRevenue =
    getDashboardPeriodNetRevenueBuckets(orders, customerReturns, "quarter").get(
      currentQuarter,
    ) ?? 0;
  const [year] = currentQuarter.split("-Q");
  const quarterLimit =
    year === "2026" ? unregisteredActivityQuarterlyLimit2026 : 0;
  const usageRatio = quarterLimit > 0 ? quarterRevenue / quarterLimit : 0;
  const remaining = Math.max(0, quarterLimit - quarterRevenue);

  return {
    monthRevenue,
    quarterLimit,
    quarterRevenue,
    remaining,
    usagePercent: `${Math.round(usageRatio * 1000) / 10}%`,
    warning:
      quarterLimit === 0
        ? "Sprawdź i ustaw aktualny limit dla tego roku."
        : quarterRevenue > quarterLimit
          ? "Limit kwartalny został przekroczony. Sprawdź obowiązek rejestracji działalności."
          : usageRatio >= limitWarningRatio
            ? "Zbliżasz się do limitu kwartalnego działalności nierejestrowanej."
            : "Limit kwartalny jest pod kontrolą.",
  };
}

function getDashboardCustomerReturns(
  orders: FinancialOrderRow[],
  returnCases: FinancialReturnCaseRow[],
) {
  const returnCaseOrderIds = new Set(
    returnCases.map((returnCase) => returnCase.order_id),
  );
  const returnCaseRecords = returnCases.map((returnCase) => ({
    amount: money(Number(returnCase.approved_refund_amount)),
    date: getDashboardReturnDate(returnCase),
    orderId: returnCase.order_id,
  }));
  const directOrderRefunds = orders
    .filter(
      (order) => order.stripe_refund_id && !returnCaseOrderIds.has(order.id),
    )
    .map((order) => ({
      amount: getDashboardOrderRefundAmount(order),
      date: order.refunded_at ?? order.updated_at,
      orderId: order.id,
    }));

  return [...returnCaseRecords, ...directOrderRefunds];
}

function getDashboardPeriodNetRevenueBuckets(
  orders: FinancialOrderRow[],
  customerReturns: DashboardCustomerReturn[],
  periodType: "month" | "quarter",
) {
  const salesBuckets = getDashboardOrderRevenueBuckets(orders, periodType);
  const returnBuckets = getDashboardReturnBuckets(customerReturns, periodType);
  const periods = [
    ...new Set([...salesBuckets.keys(), ...returnBuckets.keys()]),
  ].sort();
  const buckets = new Map<string, number>();

  periods.forEach((period) => {
    buckets.set(
      period,
      money(
        Math.max(
          0,
          (salesBuckets.get(period) ?? 0) - (returnBuckets.get(period) ?? 0),
        ),
      ),
    );
  });

  return buckets;
}

function getDashboardOrderRevenueBuckets(
  orders: FinancialOrderRow[],
  periodType: "month" | "quarter",
) {
  return orders.filter(isDashboardRevenueOrder).reduce((buckets, order) => {
    const period = getDatePeriod(order.paid_at ?? order.created_at, periodType);
    buckets.set(period, money((buckets.get(period) ?? 0) + Number(order.total)));

    return buckets;
  }, new Map<string, number>());
}

function getDashboardReturnBuckets(
  customerReturns: DashboardCustomerReturn[],
  periodType: "month" | "quarter",
) {
  return customerReturns.reduce((buckets, record) => {
    const period = getDatePeriod(record.date, periodType);
    buckets.set(period, money((buckets.get(period) ?? 0) + record.amount));

    return buckets;
  }, new Map<string, number>());
}

function isDashboardRevenueOrder(
  order: Pick<FinancialOrderRow, "paid_at" | "status">,
) {
  return Boolean(order.paid_at) || ["paid", "shipped"].includes(order.status);
}

function getDashboardOrderRefundAmount(order: FinancialOrderRow) {
  const refundTotal = Number(order.refund_total);

  if (Number.isFinite(refundTotal) && refundTotal > 0) {
    return money(refundTotal);
  }

  return money(
    Math.max(0, Number(order.subtotal) - Number(order.discount_total)) +
      Number(order.delivery_cost),
  );
}

function getDashboardReturnDate(
  returnCase: Pick<
    FinancialReturnCaseRow,
    "created_at" | "refunded_at" | "updated_at"
  >,
) {
  return returnCase.refunded_at ?? returnCase.updated_at ?? returnCase.created_at;
}

function AdminOrdersPagination({
  currentPage,
  pageEnd,
  pageStart,
  q,
  status,
  totalOrders,
  totalPages,
}: {
  currentPage: number;
  pageEnd: number;
  pageStart: number;
  q: string;
  status: OrderStatus | null;
  totalOrders: number;
  totalPages: number;
}) {
  const pages = getPaginationPages(currentPage, totalPages);

  return (
    <nav
      aria-label="Strony zamówień"
      className="mt-4 rounded-lg border border-[#26313c] bg-[#111820] p-4 shadow-lg shadow-black/20"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm font-semibold text-[#cbd6df]">
          Pokazuję {pageStart}-{pageEnd} z {totalOrders} zamówień w tym widoku.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {currentPage > 1 ? (
            <Link
              href={buildAdminOrdersPageHref({
                page: currentPage - 1,
                q,
                status: status ?? undefined,
              })}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#344252] bg-[#151b22] px-4 text-sm font-semibold text-white transition hover:border-[#f4a261] hover:bg-[#1b232d]"
            >
              Poprzednia
            </Link>
          ) : (
            <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-lg border border-[#26313c] bg-black/20 px-4 text-sm font-semibold text-[#6f7f8c]">
              Poprzednia
            </span>
          )}

          {pages.map((page, index) => {
            const previousPage = pages[index - 1];
            const showGap = previousPage !== undefined && page - previousPage > 1;

            return (
              <span className="flex items-center gap-2" key={page}>
                {showGap ? (
                  <span className="px-1 text-sm font-semibold text-[#6f7f8c]">
                    ...
                  </span>
                ) : null}
                <Link
                  aria-current={page === currentPage ? "page" : undefined}
                  href={buildAdminOrdersPageHref({
                    page,
                    q,
                    status: status ?? undefined,
                  })}
                  className={[
                    "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition",
                    page === currentPage
                      ? "border-[#f4a261] bg-[#f4a261] text-[#11151b]"
                      : "border-[#344252] bg-[#151b22] text-white hover:border-[#f4a261] hover:bg-[#1b232d]",
                  ].join(" ")}
                >
                  {page}
                </Link>
              </span>
            );
          })}

          {currentPage < totalPages ? (
            <Link
              href={buildAdminOrdersPageHref({
                page: currentPage + 1,
                q,
                status: status ?? undefined,
              })}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#344252] bg-[#151b22] px-4 text-sm font-semibold text-white transition hover:border-[#f4a261] hover:bg-[#1b232d]"
            >
              Następna
            </Link>
          ) : (
            <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-lg border border-[#26313c] bg-black/20 px-4 text-sm font-semibold text-[#6f7f8c]">
              Następna
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

function getPaginationPages(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, totalPages, currentPage]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 3);
    pages.add(totalPages - 2);
    pages.add(totalPages - 1);
  }

  return [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((firstPage, secondPage) => firstPage - secondPage);
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

function getOrderItemProfit(
  item: Pick<
    OrderItemRow,
    "line_total" | "purchase_total" | "quantity" | "unit_purchase_price"
  >,
) {
  return money(Number(item.line_total) - getOrderItemPurchaseTotal(item));
}

function getOrderItemPurchaseTotal(
  item: Pick<
    OrderItemRow,
    "purchase_total" | "quantity" | "unit_purchase_price"
  >,
) {
  const purchaseTotal = Number(item.purchase_total);

  if (Number.isFinite(purchaseTotal) && purchaseTotal > 0) {
    return money(purchaseTotal);
  }

  return money(getOrderItemUnitPurchasePrice(item) * item.quantity);
}

function getReturnItemPurchaseLoss(item: FinancialReturnCaseItemRow) {
  if (!item.order_items) {
    return 0;
  }

  return money(getOrderItemUnitPurchasePrice(item.order_items) * item.quantity);
}

function getOrderItemUnitPurchasePrice(
  item: Pick<
    OrderItemRow,
    "purchase_total" | "quantity" | "unit_purchase_price"
  >,
) {
  const unitPurchasePrice = Number(item.unit_purchase_price);

  if (Number.isFinite(unitPurchasePrice) && unitPurchasePrice > 0) {
    return unitPurchasePrice;
  }

  const purchaseTotal = Number(item.purchase_total);

  if (
    Number.isFinite(purchaseTotal) &&
    purchaseTotal > 0 &&
    item.quantity > 0
  ) {
    return purchaseTotal / item.quantity;
  }

  return 0;
}

function money(value: number) {
  return Math.round(Number(value) * 100) / 100;
}

function getDatePeriod(value: string, periodType: "month" | "quarter") {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (periodType === "month") {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  return `${year}-Q${Math.ceil(month / 3)}`;
}

function getWarsawDateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
  }).format(date);
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

function getChronologicalOrderEvents(
  events: Database["public"]["Tables"]["order_events"]["Row"][],
) {
  return [...events].sort(
    (firstEvent, secondEvent) =>
      new Date(firstEvent.created_at).getTime() -
      new Date(secondEvent.created_at).getTime(),
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
