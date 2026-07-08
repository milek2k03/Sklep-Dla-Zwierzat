import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Banknote, PackageX, RotateCcw, Search, Sigma } from "lucide-react";
import {
  closeReturnCaseAction,
  createReturnCaseAction,
  updateReturnCaseStatusAction,
} from "@/app/admin/returns/actions";
import { ReturnCaseControls } from "@/components/admin/ReturnCaseControls";
import { storeBrandName } from "@/lib/brand";
import { formatPrice } from "@/lib/format";
import {
  getReturnCondition,
  getReturnConditionLabel,
  returnConditionBadgeClasses,
} from "@/lib/return-conditions";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const metadata: Metadata = {
  title: `Zwroty i reklamacje | ${storeBrandName}`,
};

export const dynamic = "force-dynamic";

type AdminReturnsPageProps = {
  searchParams: Promise<{
    order?: string | string[];
    q?: string | string[];
    error?: string | string[];
    saved?: string | string[];
  }>;
};

type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ReturnCaseRow = Database["public"]["Tables"]["return_cases"]["Row"];
type ReturnCaseItemRow =
  Database["public"]["Tables"]["return_case_items"]["Row"];
type ReturnCaseItemWithOrderItem = ReturnCaseItemRow & {
  order_items: Pick<
    OrderItemRow,
    "unit_price" | "line_total" | "quantity" | "unit_purchase_price" | "purchase_total"
  > | null;
};
type ReturnCaseListRow = ReturnCaseRow & {
  orders: Pick<
    OrderRow,
    | "id"
    | "order_number"
    | "customer_full_name"
    | "customer_email"
    | "status"
    | "total"
    | "payment_method"
    | "stripe_payment_intent_id"
  > | null;
  return_case_items: ReturnCaseItemWithOrderItem[];
};
type OrderWithItems = OrderRow & {
  order_items: OrderItemRow[];
};
type ExistingReturnItem = Pick<
  ReturnCaseItemRow,
  "order_item_id" | "product_name"
> & {
  return_cases: Pick<ReturnCaseRow, "case_number" | "status"> | null;
};

const caseTypeLabels: Record<ReturnCaseRow["case_type"], string> = {
  return: "Zwrot",
  claim: "Reklamacja",
  exchange: "Wymiana",
};

const caseStatusLabels: Record<ReturnCaseRow["status"], string> = {
  reported: "Zgłoszone",
  awaiting_package: "Oczekuje na paczkę",
  package_received: "Paczka odebrana",
  accepted: "Zaakceptowane",
  rejected: "Odrzucone",
  closed: "Zamknięte",
};

export default async function AdminReturnsPage({
  searchParams,
}: AdminReturnsPageProps) {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (adminSession.status !== "admin") {
    redirect("/admin");
  }

  const resolvedSearchParams = await searchParams;
  const selectedOrderId = getFirstSearchParam(resolvedSearchParams.order);
  const query = getFirstSearchParam(resolvedSearchParams.q)?.trim() ?? "";
  const error = getFirstSearchParam(resolvedSearchParams.error);
  const saved = getFirstSearchParam(resolvedSearchParams.saved);
  const supabase = await createSupabaseServerClient();
  const [
    returnCasesResult,
    selectedOrderResult,
    searchedOrdersResult,
    existingReturnItemsResult,
  ] =
    await Promise.all([
      supabase
        .from("return_cases")
        .select("*, orders(id, order_number, customer_full_name, customer_email, status, total, payment_method, stripe_payment_intent_id), return_case_items(*, order_items(unit_price, line_total, quantity, unit_purchase_price, purchase_total))")
        .order("created_at", { ascending: false })
        .limit(50),
      selectedOrderId
        ? supabase
            .from("orders")
            .select("*, order_items(*)")
            .eq("id", selectedOrderId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      query
        ? supabase
            .from("orders")
            .select("id, order_number, customer_full_name, customer_email, status, total, created_at")
            .or(
              `order_number.ilike.%${query}%,customer_email.ilike.%${query}%,customer_full_name.ilike.%${query}%`,
            )
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      selectedOrderId
        ? supabase
            .from("return_case_items")
            .select("order_item_id, product_name, return_cases(case_number, status)")
            .eq("return_cases.order_id", selectedOrderId)
        : Promise.resolve({ data: [], error: null }),
    ]);
  const returnCases = (returnCasesResult.data ?? []) as ReturnCaseListRow[];
  const selectedOrder = selectedOrderResult.data as OrderWithItems | null;
  const searchedOrders = (searchedOrdersResult.data ?? []) as Pick<
    OrderRow,
    | "id"
    | "order_number"
    | "customer_full_name"
    | "customer_email"
    | "status"
    | "total"
    | "created_at"
  >[];
  const searchedOrdersWithAvailableItems = await filterOrdersWithReturnableItems(
    searchedOrders,
  );
  const existingReturnItems = (existingReturnItemsResult.data ??
    []) as ExistingReturnItem[];
  const lossSummary = getReturnLossSummary(returnCases);

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
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Obsługa posprzedażowa
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
              Zwroty i reklamacje
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6d675f]">
              Oddziel anulowanie przed wysyłką od zwrotów, reklamacji i wymian
              po powrocie paczki.
            </p>
          </div>
          <div className="rounded-lg bg-[#1f1f1f] px-4 py-3 text-white">
            <p className="text-xs text-white/62">Sprawy</p>
            <p className="text-xl font-semibold">{returnCases.length}</p>
          </div>
        </div>
      </div>

      {saved ? (
        <div className="mt-6 rounded-lg border border-[#cfe8d2] bg-[#ecf8ee] p-4 text-sm font-semibold text-[#2f6b3f]">
          Zapisano zmiany w sprawie.
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f3cbbd] bg-[#fff1e8] p-4 text-sm font-semibold text-[#a64022]">
          {error}
        </div>
      ) : null}

      <ReturnLossSummaryCards summary={lossSummary} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-xl font-semibold text-[#1f1f1f]">
            Nowa sprawa
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#6d675f]">
            Wyszukaj zamówienie albo otwórz tę stronę z konkretnego zamówienia.
          </p>

          <form action="/admin/returns" className="mt-5 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a746d]"
                aria-hidden="true"
              />
              <input
                name="q"
                className="field-input min-h-11 py-2.5"
                style={{ paddingLeft: "3.25rem" }}
                defaultValue={query}
                placeholder="Numer, e-mail, klient..."
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
            >
              Szukaj
            </button>
          </form>

          {searchedOrdersWithAvailableItems.length > 0 ? (
            <div className="mt-4 divide-y divide-[#eee7db] rounded-lg border border-[#eee7db]">
              {searchedOrdersWithAvailableItems.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/returns?order=${order.id}`}
                  className="block p-3 text-sm transition hover:bg-[#fffdf8]"
                >
                  <span className="font-semibold text-[#1f1f1f]">
                    {order.order_number}
                  </span>
                  <span className="mt-1 block text-[#6d675f]">
                    {order.customer_full_name} • {formatPrice(Number(order.total))}
                  </span>
                </Link>
              ))}
            </div>
          ) : query ? (
            <div className="mt-4 rounded-lg border border-[#eee7db] bg-[#fffdf8] p-4 text-sm leading-6 text-[#6d675f]">
              Nie znaleziono zamówienia z produktami dostępnymi do nowej
              sprawy. Jeśli produkt jest już w sprawie zwrotu/reklamacji, nie
              pojawi się tutaj ponownie.
            </div>
          ) : null}

          {selectedOrder ? (
            <CreateReturnCaseForm
              existingReturnItems={existingReturnItems}
              order={selectedOrder}
            />
          ) : (
            <div className="mt-5 rounded-lg bg-[#f7f1e8] p-4 text-sm leading-6 text-[#6d675f]">
              Sprawę najlepiej utworzyć z zamówienia w statusie opłaconym albo
              wysłanym. Produkty wybierzesz dopiero po wskazaniu zamówienia.
            </div>
          )}
        </aside>

        <div className="space-y-5">
          {returnCases.length === 0 ? (
            <div className="rounded-lg border border-[#eee7db] bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-[#1f1f1f]">
                Brak spraw
              </h2>
              <p className="mt-2 text-sm text-[#6d675f]">
                Zwroty, reklamacje i wymiany pojawią się tutaj.
              </p>
            </div>
          ) : (
            returnCases.map((returnCase) => (
              <ReturnCaseCard key={returnCase.id} returnCase={returnCase} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ReturnLossSummaryCards({
  summary,
}: {
  summary: ReturnType<typeof getReturnLossSummary>;
}) {
  const cards = [
    {
      icon: Banknote,
      label: "Zwroty klientom",
      value: summary.customerRefundLoss,
      hint:
        summary.pendingCustomerRefund > 0
          ? `Potencjalnie do decyzji: ${formatPrice(summary.pendingCustomerRefund)}`
          : "Zatwierdzone kwoty zwrotow",
    },
    {
      icon: PackageX,
      label: "Towar poza sprzedaza",
      value: summary.inventoryLoss,
      hint: "Cena zakupu produktów niewracających do sprzedaży",
    },
    {
      icon: Sigma,
      label: "Razem potwierdzone straty",
      value: summary.totalConfirmedLoss,
      hint: `${summary.lossCaseCount} spraw ze strata`,
    },
  ];

  return (
    <div className="mt-6 grid gap-3 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            className="rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm"
            key={card.label}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#6d675f]">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1f1f1f]">
                  {formatPrice(card.value)}
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#f7f1e8] text-[#b65320]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#7a746d]">{card.hint}</p>
          </div>
        );
      })}
    </div>
  );
}

function CreateReturnCaseForm({
  existingReturnItems,
  order,
}: {
  existingReturnItems: ExistingReturnItem[];
  order: OrderWithItems;
}) {
  const existingReturnItemsByOrderItemId = new Map(
    existingReturnItems.map((item) => [item.order_item_id, item]),
  );

  return (
    <form action={createReturnCaseAction} className="mt-5 grid gap-4">
      <input type="hidden" name="orderId" value={order.id} />
      <div className="rounded-lg bg-[#fffdf8] p-4 text-sm">
        <p className="font-semibold text-[#1f1f1f]">{order.order_number}</p>
        <p className="mt-1 text-[#6d675f]">
          {order.customer_full_name} • {formatPrice(Number(order.total))}
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-[#1f1f1f]">Typ sprawy</span>
        <select name="caseType" className="field-input mt-2" defaultValue="return">
          <option value="return">Zwrot</option>
          <option value="claim">Reklamacja</option>
          <option value="exchange">Wymiana</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-[#1f1f1f]">
          Oczekiwana kwota zwrotu
        </span>
              <input
                name="requestedRefundAmount"
                className="field-input mt-2"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0,00"
              />
      </label>

      <div>
        <p className="text-sm font-semibold text-[#1f1f1f]">Produkty</p>
        <div className="mt-2 divide-y divide-[#eee7db] rounded-lg border border-[#eee7db]">
          {order.order_items.map((item) => (
            <label
              key={item.id}
              className="grid gap-3 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_90px] sm:items-center"
            >
              <span>
                <span className="block font-semibold text-[#1f1f1f]">
                  {item.product_name}
                </span>
                <span className="mt-1 block text-[#6d675f]">
                  Zamówiono: {item.quantity} • Cena szt.:{" "}
                  {formatPrice(Number(item.unit_price))} • Linia:{" "}
                  {formatPrice(Number(item.line_total))}
                </span>
                {existingReturnItemsByOrderItemId.has(item.id) ? (
                  <span className="mt-1 block text-xs font-semibold text-[#a64022]">
                    Już w sprawie{" "}
                    {
                      existingReturnItemsByOrderItemId.get(item.id)
                        ?.return_cases?.case_number
                    }
                  </span>
                ) : null}
              </span>
              <input
                name={`quantity:${item.id}`}
                className="field-input min-h-10 py-2"
                type="number"
                min="0"
                max={item.quantity}
                defaultValue="0"
                disabled={existingReturnItemsByOrderItemId.has(item.id)}
              />
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-[#1f1f1f]">
          Opis klienta
        </span>
        <textarea
          name="customerMessage"
          className="field-input mt-2 min-h-24 resize-y"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-[#1f1f1f]">
          Notatka admina
        </span>
        <textarea
          name="adminNotes"
          className="field-input mt-2 min-h-20 resize-y"
        />
      </label>

      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#e86f2c] px-5 text-sm font-semibold text-white transition hover:bg-[#cf5f25]"
      >
        Utwórz sprawę
      </button>
    </form>
  );
}

function ReturnCaseCard({ returnCase }: { returnCase: ReturnCaseListRow }) {
  const isClosed = returnCase.status === "closed";
  const returnItemsTotal = getReturnItemsTotal(returnCase.return_case_items);
  const loss = getReturnCaseLoss(returnCase);

  return (
    <article className="overflow-hidden rounded-lg border border-[#eee7db] bg-white shadow-sm">
      <div className="grid gap-5 border-b border-[#eee7db] p-5 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-xl font-semibold text-[#1f1f1f]">
              {returnCase.case_number}
            </h2>
            <span className="rounded-full bg-[#f7f1e8] px-3 py-1 text-xs font-semibold text-[#6d675f]">
              {caseTypeLabels[returnCase.case_type]}
            </span>
            <span className="rounded-full bg-[#e8f4ea] px-3 py-1 text-xs font-semibold text-[#2f6b3f]">
              {caseStatusLabels[returnCase.status]}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#6d675f]">
            {returnCase.orders?.order_number ?? "Zamówienie"} •{" "}
            {returnCase.orders?.customer_full_name ?? "-"}
          </p>
        </div>
        <div className="rounded-lg bg-[#1f1f1f] px-4 py-3 text-white lg:text-right">
          <p className="text-xs text-white/62">Oczekiwany zwrot</p>
          <p className="text-lg font-semibold">
            {formatPrice(Number(returnCase.requested_refund_amount))}
          </p>
          <p className="mt-1 text-xs text-white/62">
            Pozycje: {formatPrice(returnItemsTotal)}
          </p>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-3">
          {returnCase.customer_message ? (
            <div className="rounded-lg bg-[#fffdf8] p-4 text-sm leading-6 text-[#6d675f]">
              <p className="mb-1 font-semibold text-[#1f1f1f]">
                Notatka klienta:
              </p>
              <p className="break-words">{returnCase.customer_message}</p>
            </div>
          ) : null}

          {returnCase.admin_notes ? (
            <div className="rounded-lg bg-[#f7f1e8] p-4 text-sm leading-6 text-[#6d675f]">
              <p className="mb-1 font-semibold text-[#1f1f1f]">
                Notatka admina:
              </p>
              <p className="break-words">{returnCase.admin_notes}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-5 divide-y divide-[#eee7db] rounded-lg bg-[#fffdf8]">
        {returnCase.return_case_items.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_100px_150px] sm:items-start"
          >
            <span className="min-w-0 break-words font-semibold text-[#1f1f1f]">
              {item.product_name}
              <span className="mt-1 block text-xs font-normal text-[#6d675f]">
                Cena szt.: {formatPrice(getReturnItemUnitPrice(item))} • Wartość:{" "}
                {formatPrice(getReturnItemTotal(item))}
              </span>
              <span className="mt-1 block text-xs font-normal text-[#7a746d]">
                Koszt zakupu: {formatPrice(getReturnItemPurchaseCost(item))}
              </span>
            </span>
            <span className="text-[#6d675f]">Ilość: {item.quantity}</span>
            <span className="sm:text-right">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  returnConditionBadgeClasses[getReturnCondition(item)]
                }`}
              >
                {getReturnConditionLabel(getReturnCondition(item))}
              </span>
              {item.disposal_reason ? (
                <span className="mt-1 block text-xs leading-5 text-[#7a746d]">
                  {item.disposal_reason}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <div className="m-5 grid gap-3 md:grid-cols-3">
        <ReturnLossTile
          label="Zwrot klientowi"
          value={loss.customerRefundLoss}
          hint={
            loss.pendingCustomerRefund > 0
              ? `Do decyzji: ${formatPrice(loss.pendingCustomerRefund)}`
              : "Zatwierdzony refund"
          }
        />
        <ReturnLossTile
          label="Strata towarowa"
          value={loss.inventoryLoss}
          hint="Koszt zakupu, gdy nie wraca do sprzedaży"
        />
        <ReturnLossTile
          label="Razem"
          value={loss.confirmedLoss}
          hint="Refund + strata towaru"
        />
      </div>

      {isClosed ? (
        <div className="m-5 rounded-lg border border-[#cfe8d2] bg-[#ecf8ee] p-4 text-sm text-[#2f6b3f]">
          Sprawa zamknięta.{" "}
          {Number(returnCase.approved_refund_amount) > 0
            ? `Zwrot: ${formatPrice(Number(returnCase.approved_refund_amount))}.`
            : "Bez zwrotu płatności."}
        </div>
      ) : (
        <ReturnCaseControls
          adminNotes={returnCase.admin_notes}
          caseId={returnCase.id}
          caseType={returnCase.case_type}
          closeAction={closeReturnCaseAction}
          items={returnCase.return_case_items.map((item) => ({
            id: item.id,
            productName: item.product_name,
            restockAction: item.restock_action,
            returnCondition: item.return_condition,
            disposalReason: item.disposal_reason,
            conditionNote: item.condition_note,
          }))}
          returnItemsTotal={returnItemsTotal}
          status={returnCase.status}
          updateAction={updateReturnCaseStatusAction}
        />
      )}
    </article>
  );
}

function ReturnLossTile({
  hint,
  label,
  value,
}: {
  hint: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-[#eee7db] bg-[#fffdf8] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#7a746d]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[#1f1f1f]">
        {formatPrice(value)}
      </p>
      <p className="mt-1 text-xs leading-5 text-[#6d675f]">{hint}</p>
    </div>
  );
}

function getReturnLossSummary(returnCases: ReturnCaseListRow[]) {
  const summary = returnCases.reduce(
    (total, returnCase) => {
      const loss = getReturnCaseLoss(returnCase);

      return {
        customerRefundLoss: money(
          total.customerRefundLoss + loss.customerRefundLoss,
        ),
        inventoryLoss: money(total.inventoryLoss + loss.inventoryLoss),
        lossCaseCount:
          total.lossCaseCount + (loss.confirmedLoss > 0 ? 1 : 0),
        pendingCustomerRefund: money(
          total.pendingCustomerRefund + loss.pendingCustomerRefund,
        ),
      };
    },
    {
      customerRefundLoss: 0,
      inventoryLoss: 0,
      lossCaseCount: 0,
      pendingCustomerRefund: 0,
    },
  );

  return {
    ...summary,
    totalConfirmedLoss: money(
      summary.customerRefundLoss + summary.inventoryLoss,
    ),
  };
}

function getReturnCaseLoss(returnCase: ReturnCaseListRow) {
  const customerRefundLoss = money(Number(returnCase.approved_refund_amount));
  const requestedRefundAmount = money(Number(returnCase.requested_refund_amount));
  const pendingCustomerRefund =
    returnCase.status === "closed"
      ? 0
      : money(Math.max(0, requestedRefundAmount - customerRefundLoss));
  const inventoryLoss = money(
    returnCase.return_case_items
      .filter((item) => getReturnCondition(item) === "unsellable")
      .reduce((total, item) => total + getReturnItemPurchaseCost(item), 0),
  );

  return {
    customerRefundLoss,
    confirmedLoss: money(customerRefundLoss + inventoryLoss),
    inventoryLoss,
    pendingCustomerRefund,
  };
}

function getReturnItemsTotal(items: ReturnCaseItemWithOrderItem[]) {
  return money(items.reduce((total, item) => total + getReturnItemTotal(item), 0));
}

function getReturnItemUnitPrice(item: ReturnCaseItemWithOrderItem) {
  if (item.order_items?.unit_price !== undefined) {
    return Number(item.order_items.unit_price);
  }

  if (item.order_items?.line_total && item.order_items.quantity) {
    return Number(item.order_items.line_total) / item.order_items.quantity;
  }

  return 0;
}

function getReturnItemTotal(item: ReturnCaseItemWithOrderItem) {
  return money(getReturnItemUnitPrice(item) * item.quantity);
}

function getReturnItemPurchaseCost(item: ReturnCaseItemWithOrderItem) {
  return money(getReturnItemUnitPurchasePrice(item) * item.quantity);
}

function getReturnItemUnitPurchasePrice(item: ReturnCaseItemWithOrderItem) {
  if (item.order_items?.unit_purchase_price !== undefined) {
    const unitPurchasePrice = Number(item.order_items.unit_purchase_price);

    if (Number.isFinite(unitPurchasePrice) && unitPurchasePrice > 0) {
      return unitPurchasePrice;
    }
  }

  if (item.order_items?.purchase_total && item.order_items.quantity) {
    return Number(item.order_items.purchase_total) / item.order_items.quantity;
  }

  return 0;
}

function money(value: number) {
  return Math.round(Number(value) * 100) / 100;
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function filterOrdersWithReturnableItems<
  Order extends Pick<OrderRow, "id">,
>(orders: Order[]) {
  if (orders.length === 0) {
    return orders;
  }

  const supabase = await createSupabaseServerClient();
  const orderIds = orders.map((order) => order.id);
  const [{ data: orderItems }, { data: returnItems }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, order_id")
      .in("order_id", orderIds),
    supabase
      .from("return_case_items")
      .select("order_item_id, order_items(order_id)")
      .in("order_items.order_id", orderIds),
  ]);
  const returnedOrderItemIds = new Set(
    (returnItems ?? []).map((item) => item.order_item_id),
  );
  const returnableOrderIds = new Set(
    (orderItems ?? [])
      .filter((item) => !returnedOrderItemIds.has(item.id))
      .map((item) => item.order_id),
  );

  return orders.filter((order) => returnableOrderIds.has(order.id));
}
