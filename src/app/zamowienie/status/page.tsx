import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, PackageCheck, Search, Truck } from "lucide-react";
import { deliveryOptions } from "@/lib/delivery";
import { formatPrice } from "@/lib/format";
import { orderStatusLabels } from "@/lib/order-status";
import {
  getReturnAddressLines,
  getReturnShipmentInstructionLines,
} from "@/lib/returns";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { createPublicReturnCaseAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status zamówienia | Pawly",
};

type SearchParams = {
  order?: string | string[];
  email?: string | string[];
  caseSaved?: string | string[];
  caseError?: string | string[];
};

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ReturnCaseRow = Database["public"]["Tables"]["return_cases"]["Row"];
type ReturnCaseItemRow = Database["public"]["Tables"]["return_case_items"]["Row"];

type PublicOrder = OrderRow & {
  order_items: OrderItemRow[];
  return_cases: Array<
    ReturnCaseRow & {
      return_case_items: ReturnCaseItemRow[];
    }
  >;
};

type OrderStatusPageProps = {
  searchParams: Promise<SearchParams>;
};

const returnTypeLabels: Record<ReturnCaseRow["case_type"], string> = {
  return: "Zwrot",
  claim: "Reklamacja",
  exchange: "Wymiana",
};

const returnStatusLabels: Record<ReturnCaseRow["status"], string> = {
  reported: "Zgłoszone",
  awaiting_package: "Oczekuje na paczkę",
  package_received: "Paczka odebrana",
  accepted: "Zaakceptowane",
  rejected: "Odrzucone",
  closed: "Zamknięte",
};

export default async function OrderStatusPage({
  searchParams,
}: OrderStatusPageProps) {
  const resolvedSearchParams = await searchParams;
  const orderNumber = normalizeOrderNumber(resolvedSearchParams.order);
  const email = normalizeEmail(resolvedSearchParams.email);
  const caseSaved = normalizeBooleanParam(resolvedSearchParams.caseSaved);
  const caseError = normalizeMessageParam(resolvedSearchParams.caseError);
  const shouldSearch = Boolean(orderNumber && email);
  const order = shouldSearch ? await findOrder(orderNumber, email) : null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="h-fit rounded-lg border border-[#eadfce] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#9b6f39]">
            Sprawdzenie zamówienia
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1f1f1f]">
            Status zamówienia
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6d675f]">
            Wpisz numer zamówienia oraz adres e-mail podany przy zakupie.
          </p>

          <form action="/zamowienie/status" className="mt-6 space-y-4" method="get">
            <label className="block text-sm font-semibold text-[#1f1f1f]">
              Numer zamówienia
              <input
                className="mt-2 min-h-12 w-full rounded-lg border border-[#ded2bf] bg-white px-4 text-base text-[#1f1f1f] outline-none transition focus:border-[#1f1f1f]"
                defaultValue={orderNumber}
                name="order"
                placeholder="np. PAWLY-MR..."
                required
              />
            </label>
            <label className="block text-sm font-semibold text-[#1f1f1f]">
              E-mail
              <input
                className="mt-2 min-h-12 w-full rounded-lg border border-[#ded2bf] bg-white px-4 text-base text-[#1f1f1f] outline-none transition focus:border-[#1f1f1f]"
                defaultValue={email}
                name="email"
                placeholder="adres@email.pl"
                required
                type="email"
              />
            </label>
            <button
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
              type="submit"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Sprawdź status
            </button>
          </form>
        </aside>

        <div className="space-y-5">
          {caseSaved ? (
            <div className="rounded-lg border border-[#cce5d2] bg-[#f0faf2] p-4 text-sm font-semibold text-[#2f6b3f]">
              Zgłoszenie zostało zapisane. Status sprawy znajdziesz niżej na tej
              stronie.
            </div>
          ) : null}
          {caseError ? (
            <div className="rounded-lg border border-[#f2c5b8] bg-[#fff2ed] p-4 text-sm font-semibold text-[#b44927]">
              {caseError}
            </div>
          ) : null}
          {!hasSupabaseServiceEnv() ? (
            <MessageCard
              title="Brak konfiguracji"
              message="Do sprawdzania statusu zamówień potrzebna jest konfiguracja Supabase service role po stronie serwera."
            />
          ) : !shouldSearch ? (
            <MessageCard
              title="Wprowadź dane zamówienia"
              message="Po sprawdzeniu zobaczysz status płatności, wysyłki, numer śledzenia i sprawy zwrotów lub reklamacji."
            />
          ) : order ? (
            <OrderDetails order={order} />
          ) : (
            <MessageCard
              title="Nie znaleziono zamówienia"
              message="Sprawdź numer zamówienia i e-mail. Dla bezpieczeństwa pokazujemy dane tylko przy pełnej zgodności tych dwóch pól."
            />
          )}
        </div>
      </div>
    </section>
  );
}

async function findOrder(orderNumber: string, email: string) {
  if (!hasSupabaseServiceEnv()) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        *,
        order_items (*),
        return_cases (
          *,
          return_case_items (*)
        )
      `,
    )
    .eq("order_number", orderNumber)
    .ilike("customer_email", email)
    .maybeSingle();

  if (error) {
    console.error("Order status lookup failed", error);
    return null;
  }

  return data as PublicOrder | null;
}

function OrderDetails({ order }: { order: PublicOrder }) {
  const deliveryName =
    deliveryOptions.find((option) => option.id === order.delivery_method)?.name ??
    order.delivery_method;
  const hasTracking = Boolean(order.tracking_number || order.tracking_url);
  const sortedItems = [...order.order_items].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const sortedCases = [...order.return_cases].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const reportedOrderItemIds = new Set(
    order.return_cases.flatMap((returnCase) =>
      returnCase.return_case_items.map((item) => item.order_item_id),
    ),
  );
  const availableReturnItems = sortedItems.filter(
    (item) => !reportedOrderItemIds.has(item.id),
  );
  const canCreateReturnCase = ["paid", "shipped"].includes(order.status);
  const returnAddressLines = getReturnAddressLines();

  return (
    <>
      <article className="rounded-lg border border-[#eadfce] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#f0e7da] p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-[#6d675f]">Zamówienie</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#1f1f1f]">
              {order.order_number}
            </h2>
            <p className="mt-1 text-sm text-[#6d675f]">
              {order.customer_full_name} • {formatDate(order.created_at)}
            </p>
          </div>
          <div className="rounded-lg bg-[#1f1f1f] px-5 py-3 text-right text-white">
            <p className="text-xs text-white/70">Status</p>
            <p className="text-lg font-semibold">{orderStatusLabels[order.status]}</p>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          <StatusTile
            icon={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
            label="Płatność"
            value={getPaymentLabel(order)}
            hint={order.paid_at ? formatDate(order.paid_at) : "Aktualizuje webhook Stripe"}
          />
          <StatusTile
            icon={<Truck className="h-5 w-5" aria-hidden="true" />}
            label="Dostawa"
            value={deliveryName}
            hint={order.shipped_at ? `Wysłano ${formatDate(order.shipped_at)}` : "W przygotowaniu"}
          />
          <StatusTile
            label="Wartość"
            value={formatPrice(order.total)}
            hint={
              order.discount_total > 0
                ? `Rabat ${formatPrice(order.discount_total)}`
                : "Razem z dostawą"
            }
          />
        </div>

        <div className="grid gap-5 border-t border-[#f0e7da] p-5 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-[#1f1f1f]">Adres dostawy</h3>
            <p className="mt-2 text-sm leading-6 text-[#6d675f]">
              {formatAddress(order)}
            </p>
            {order.pickup_point ? (
              <p className="mt-2 text-sm font-semibold text-[#1f1f1f]">
                Punkt odbioru: {order.pickup_point}
              </p>
            ) : null}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#1f1f1f]">Śledzenie przesyłki</h3>
            {hasTracking ? (
              <div className="mt-2 space-y-2 text-sm text-[#6d675f]">
                {order.shipping_carrier ? <p>Przewoźnik: {order.shipping_carrier}</p> : null}
                {order.tracking_number ? <p>Numer: {order.tracking_number}</p> : null}
                {order.tracking_url ? (
                  <Link
                    className="inline-flex items-center gap-1 font-semibold text-[#1f1f1f] underline-offset-4 hover:underline"
                    href={order.tracking_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Śledź przesyłkę
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-[#6d675f]">
                Numer śledzenia pojawi się tutaj po nadaniu paczki.
              </p>
            )}
          </div>
        </div>
      </article>

      <article className="rounded-lg border border-[#eadfce] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-[#1f1f1f]">Produkty</h3>
        <div className="mt-4 divide-y divide-[#f0e7da]">
          {sortedItems.map((item) => (
            <div
              className="grid gap-2 py-4 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center"
              key={item.id}
            >
              <div>
                <p className="font-semibold text-[#1f1f1f]">{item.product_name}</p>
                <p className="mt-1 text-[#6d675f]">
                  Cena szt.: {formatPrice(item.unit_price)}
                </p>
              </div>
              <p className="text-[#6d675f]">Ilość: {item.quantity}</p>
              <p className="font-semibold text-[#1f1f1f]">
                {formatPrice(item.line_total)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-[#f0e7da] pt-4 text-sm">
          <SummaryLine label="Produkty" value={formatPrice(order.subtotal)} />
          {order.discount_total > 0 ? (
            <SummaryLine label="Rabat" value={`-${formatPrice(order.discount_total)}`} />
          ) : null}
          <SummaryLine label="Dostawa" value={formatPrice(order.delivery_cost)} />
          <SummaryLine label="Razem" value={formatPrice(order.total)} strong />
        </div>
      </article>

      <article className="rounded-lg border border-[#eadfce] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-[#1f1f1f]">
          Zwroty, reklamacje i wymiany
        </h3>
        <ReturnCaseRequestForm
          canCreate={canCreateReturnCase}
          email={order.customer_email}
          items={availableReturnItems}
          orderNumber={order.order_number}
        />
        {sortedCases.length > 0 ? (
          <div className="mt-4 space-y-3">
            {sortedCases.map((returnCase) => (
              <div
                className="rounded-lg border border-[#f0e7da] bg-[#fffaf2] p-4"
                key={returnCase.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-[#1f1f1f]">
                      {returnCase.case_number}
                    </p>
                    <p className="mt-1 text-sm text-[#6d675f]">
                      {returnTypeLabels[returnCase.case_type]} •{" "}
                      {formatDate(returnCase.created_at)}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-[#e8f4ea] px-3 py-1 text-xs font-semibold text-[#2f6b3f]">
                    {returnStatusLabels[returnCase.status]}
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-[#6d675f]">
                  {returnCase.customer_message ? (
                    <p>Notatka klienta: {returnCase.customer_message}</p>
                  ) : null}
                  {returnCase.return_case_items.map((item) => (
                    <p key={item.id}>
                      {item.product_name} • ilość: {item.quantity}
                    </p>
                  ))}
                  {returnCase.approved_refund_amount > 0 ? (
                    <p className="font-semibold text-[#1f1f1f]">
                      Zatwierdzony zwrot:{" "}
                      {formatPrice(returnCase.approved_refund_amount)}
                    </p>
                  ) : null}
                  {shouldShowReturnAddress(returnCase.status) &&
                  returnAddressLines.length > 0 ? (
                    <div className="mt-4 rounded-lg border border-[#eadfce] bg-white p-4 text-[#6d675f]">
                      <p className="font-semibold text-[#1f1f1f]">
                        Adres do wysyłki zwrotu/reklamacji
                      </p>
                      <div className="mt-2 leading-6">
                        {returnAddressLines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-5">
                        Instrukcja odesłania została też wysłana na adres e-mail
                        podany w zamówieniu.
                      </p>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5">
                        {getReturnShipmentInstructionLines(
                          returnCase.case_number,
                        ).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[#6d675f]">
            Dla tego zamówienia nie ma aktualnie zgłoszonych zwrotów,
            reklamacji ani wymian.
          </p>
        )}
      </article>
    </>
  );
}

function ReturnCaseRequestForm({
  canCreate,
  email,
  items,
  orderNumber,
}: {
  canCreate: boolean;
  email: string;
  items: OrderItemRow[];
  orderNumber: string;
}) {
  if (!canCreate) {
    return (
      <p className="mt-3 rounded-lg bg-[#fbf6ed] p-4 text-sm leading-6 text-[#6d675f]">
        Zgłoszenie zwrotu, reklamacji lub wymiany będzie dostępne po opłaceniu
        zamówienia.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="mt-3 rounded-lg bg-[#fbf6ed] p-4 text-sm leading-6 text-[#6d675f]">
        Wszystkie produkty z tego zamówienia mają już zgłoszoną sprawę.
      </p>
    );
  }

  return (
    <form
      action={createPublicReturnCaseAction}
      className="mt-4 rounded-lg border border-[#f0e7da] bg-[#fffaf2] p-4"
    >
      <input name="orderNumber" type="hidden" value={orderNumber} />
      <input name="email" type="hidden" value={email} />
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <label className="block text-sm font-semibold text-[#1f1f1f]">
          Typ sprawy
          <select
            className="mt-2 min-h-12 w-full rounded-lg border border-[#ded2bf] bg-white px-3 text-base text-[#1f1f1f] outline-none transition focus:border-[#1f1f1f]"
            name="caseType"
            required
          >
            <option value="return">Zwrot</option>
            <option value="claim">Reklamacja</option>
            <option value="exchange">Wymiana</option>
          </select>
        </label>
        <div className="rounded-lg border border-[#eadfce] bg-white p-3">
          <p className="text-sm font-semibold text-[#1f1f1f]">
            Produkty objęte sprawą
          </p>
          <p className="mt-1 text-xs leading-5 text-[#6d675f]">
            Wpisz ilość przy produktach, które chcesz zgłosić. Wpisz 0 przy
            pozostałych.
          </p>
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <label
                className="grid gap-3 rounded-lg bg-[#fffaf2] p-3 text-sm sm:grid-cols-[1fr_110px] sm:items-center"
                key={item.id}
              >
                <span>
                  <span className="block font-semibold text-[#1f1f1f]">
                    {item.product_name}
                  </span>
                  <span className="mt-1 block text-xs text-[#6d675f]">
                    W zamówieniu: {item.quantity} • wartość:{" "}
                    {formatPrice(item.line_total)}
                  </span>
                </span>
                <input
                  className="min-h-11 w-full rounded-lg border border-[#ded2bf] bg-white px-3 text-base text-[#1f1f1f] outline-none transition focus:border-[#1f1f1f]"
                  defaultValue={0}
                  max={item.quantity}
                  min={0}
                  name={`quantity:${item.id}`}
                  type="number"
                />
              </label>
            ))}
          </div>
        </div>
        <label className="block text-sm font-semibold text-[#1f1f1f] md:col-span-2">
          Opis sprawy
          <textarea
            className="mt-2 min-h-28 w-full rounded-lg border border-[#ded2bf] bg-white px-4 py-3 text-base text-[#1f1f1f] outline-none transition focus:border-[#1f1f1f]"
            maxLength={1200}
            name="customerMessage"
            placeholder="Opisz krótko powód zwrotu, reklamacji albo wymiany."
            required
          />
        </label>
      </div>
      <button
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d] sm:w-auto"
        type="submit"
      >
        Zgłoś sprawę
      </button>
    </form>
  );
}

function shouldShowReturnAddress(status: ReturnCaseRow["status"]) {
  return (
    status === "reported" ||
    status === "awaiting_package" ||
    status === "accepted"
  );
}

function StatusTile({
  icon,
  label,
  value,
  hint,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg bg-[#fbf6ed] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-[#1f1f1f]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#6d675f]">{hint}</p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex items-center justify-between text-base font-semibold text-[#1f1f1f]"
          : "flex items-center justify-between text-[#6d675f]"
      }
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function MessageCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-[#eadfce] bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold tracking-tight text-[#1f1f1f]">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6d675f]">{message}</p>
    </div>
  );
}

function getPaymentLabel(order: OrderRow) {
  if (order.refunded_at) {
    return "Zwrot wykonany";
  }

  if (order.paid_at || order.status === "paid" || order.status === "shipped") {
    return "Opłacone";
  }

  if (order.status === "cancelled") {
    return "Anulowane";
  }

  return "Oczekuje";
}

function formatAddress(order: OrderRow) {
  const parts = [
    [order.delivery_street, order.delivery_building_number]
      .filter(Boolean)
      .join(" "),
    [order.delivery_postal_code, order.delivery_city].filter(Boolean).join(" "),
    order.delivery_country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : order.delivery_address;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeOrderNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue?.trim().toUpperCase().slice(0, 80) ?? "";
}

function normalizeEmail(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue?.trim().toLowerCase().slice(0, 160) ?? "";
}

function normalizeBooleanParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue === "1";
}

function normalizeMessageParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue?.trim().slice(0, 240) ?? "";
}
