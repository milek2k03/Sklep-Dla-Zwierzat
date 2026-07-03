import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ReturnCaseRow = Database["public"]["Tables"]["return_cases"]["Row"];

type LedgerOrder = OrderRow & {
  order_items: OrderItemRow[];
  return_cases: ReturnCaseRow[];
};

const exportableStatuses = ["paid", "shipped", "cancelled"] as const;

export async function GET(request: NextRequest) {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unconfigured") {
    return NextResponse.json(
      { error: "SUPABASE_NOT_CONFIGURED", message: "Supabase nie jest skonfigurowany." },
      { status: 503 },
    );
  }

  if (adminSession.status === "unauthenticated") {
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Zaloguj się do panelu admina." },
      { status: 401 },
    );
  }

  if (adminSession.status === "forbidden") {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Twoje konto nie ma roli admina." },
      { status: 403 },
    );
  }

  const { searchParams } = request.nextUrl;
  const from = normalizeDateParam(searchParams.get("from"));
  const to = normalizeDateParam(searchParams.get("to"));
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("orders")
    .select("*, order_items(*), return_cases(*)")
    .in("status", [...exportableStatuses])
    .order("created_at", { ascending: true });

  if (from) {
    query = query.gte("created_at", `${from}T00:00:00.000Z`);
  }

  if (to) {
    query = query.lte("created_at", `${to}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "EXPORT_FAILED", message: error.message },
      { status: 500 },
    );
  }

  const orders = (data ?? []) as LedgerOrder[];
  const csv = buildSalesLedgerCsv(orders);
  const filename = getExportFilename(from, to);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildSalesLedgerCsv(orders: LedgerOrder[]) {
  const headers = [
    "Lp.",
    "Data sprzedaży",
    "Numer zamówienia",
    "Status",
    "Klient",
    "E-mail",
    "Produkty",
    "Kwota produktów brutto",
    "Koszt dostawy",
    "Rabat",
    "Kwota zapłacona",
    "Zwrot/refund",
    "Przychód po zwrotach",
    "Metoda płatności",
    "Stripe Payment Intent",
    "Stripe Refund ID",
    "Sprawy zwrotów",
    "Uwagi",
    "Suma narastająco",
  ];
  let runningTotal = 0;
  const rows = orders.map((order, index) => {
    const productRefundAmount = calculateProductRefundAmount(order);
    const revenueAfterRefunds = Math.max(0, money(order.total) - productRefundAmount);
    runningTotal = money(runningTotal + revenueAfterRefunds);

    return [
      String(index + 1),
      formatDateTime(order.paid_at ?? order.created_at),
      order.order_number,
      order.status,
      order.customer_full_name,
      order.customer_email,
      formatOrderItems(order.order_items),
      formatMoney(order.subtotal),
      formatMoney(order.delivery_cost),
      formatMoney(order.discount_total),
      formatMoney(order.total),
      formatMoney(productRefundAmount),
      formatMoney(revenueAfterRefunds),
      order.payment_method,
      order.stripe_payment_intent_id ?? "",
      getStripeRefundIds(order),
      getReturnCaseNumbers(order.return_cases),
      getLedgerNotes(order, productRefundAmount),
      formatMoney(runningTotal),
    ];
  });

  return `\uFEFF${[headers, ...rows].map(formatCsvRow).join("\n")}\n`;
}

function calculateProductRefundAmount(order: LedgerOrder) {
  if (order.stripe_refund_id) {
    return money(Math.max(0, money(order.subtotal) - money(order.discount_total)));
  }

  return money(
    order.return_cases.reduce(
      (sum, returnCase) =>
        returnCase.stripe_refund_id || returnCase.refunded_at
          ? sum + money(returnCase.approved_refund_amount)
          : sum,
      0,
    ),
  );
}

function formatOrderItems(items: OrderItemRow[]) {
  return items
    .map((item) => `${item.product_name} x${item.quantity} (${formatMoney(item.line_total)} zł)`)
    .join(" | ");
}

function getStripeRefundIds(order: LedgerOrder) {
  return [
    order.stripe_refund_id,
    ...order.return_cases.map((returnCase) => returnCase.stripe_refund_id),
  ]
    .filter(Boolean)
    .join(" | ");
}

function getReturnCaseNumbers(returnCases: ReturnCaseRow[]) {
  return returnCases
    .map((returnCase) => `${returnCase.case_number} (${returnCase.status})`)
    .join(" | ");
}

function getLedgerNotes(order: LedgerOrder, productRefundAmount: number) {
  const notes = [];

  if (order.status === "cancelled") {
    notes.push("zamówienie anulowane");
  }

  if (productRefundAmount > 0) {
    notes.push("zwrot produktów bez kosztu dostawy");
  }

  if (order.discount_code) {
    notes.push(`kod rabatowy: ${order.discount_code}`);
  }

  return notes.join("; ");
}

function formatCsvRow(values: string[]) {
  return values.map(escapeCsvValue).join(";");
}

function escapeCsvValue(value: string) {
  const escapedValue = value.replaceAll('"', '""');

  return `"${escapedValue}"`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return money(value).toFixed(2).replace(".", ",");
}

function money(value: number) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function getExportFilename(from: string | null, to: string | null) {
  const suffix = from || to ? `${from ?? "start"}_${to ?? "koniec"}` : "all";

  return `pawly-ewidencja-sprzedazy-${suffix}.csv`;
}
