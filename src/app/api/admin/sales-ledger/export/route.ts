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

export async function GET(request: NextRequest) {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unconfigured") {
    return NextResponse.json(
      {
        error: "SUPABASE_NOT_CONFIGURED",
        message: "Supabase nie jest skonfigurowany.",
      },
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
    "Klient",
    "Opis / produkt",
    "Kwota produktów brutto",
    "Dostawa pobrana od klienta",
    "Razem brutto",
    "Forma płatności",
    "Status zamówienia",
    "Kwota narastająco",
    "Uwagi",
  ];
  let runningTotal = 0;
  const rows = orders.map((order, index) => {
    runningTotal = money(
      runningTotal + getRecognizedOrderRevenue(order) - getCustomerRefundAmount(order),
    );

    return [
      String(index + 1),
      formatDateTime(order.paid_at ?? order.created_at),
      order.order_number,
      order.customer_full_name,
      formatOrderItems(order.order_items),
      formatMoney(getOrderProductsGross(order)),
      formatMoney(order.delivery_cost),
      formatMoney(order.total),
      getPaymentMethodLabel(order),
      getLedgerOrderStatus(order),
      formatMoney(runningTotal),
      getLedgerNotes(order),
    ];
  });

  return `\uFEFFsep=;\n${[headers, ...rows].map(formatCsvRow).join("\n")}\n`;
}

function getRecognizedOrderRevenue(order: LedgerOrder) {
  return isRevenueOrder(order) ? Number(order.total) : 0;
}

function getOrderProductsGross(
  order: Pick<OrderRow, "discount_total" | "subtotal">,
) {
  return money(
    Math.max(0, Number(order.subtotal) - Number(order.discount_total)),
  );
}

function getCustomerRefundAmount(order: LedgerOrder) {
  if (order.stripe_refund_id) {
    const refundTotal = Number(order.refund_total);

    if (Number.isFinite(refundTotal) && refundTotal > 0) {
      return money(refundTotal);
    }

    return money(getOrderProductsGross(order) + Number(order.delivery_cost));
  }

  return money(
    order.return_cases.reduce(
      (sum, returnCase) =>
        isRefundedReturnCase(returnCase)
          ? sum + money(returnCase.approved_refund_amount)
          : sum,
      0,
    ),
  );
}

function getCustomerRefundDeliveryAmount(order: LedgerOrder) {
  if (order.stripe_refund_id) {
    const refundDeliveryTotal = Number(order.refund_delivery_total);

    if (Number.isFinite(refundDeliveryTotal) && refundDeliveryTotal > 0) {
      return money(refundDeliveryTotal);
    }

    return money(Number(order.delivery_cost));
  }

  return money(
    order.return_cases.reduce((sum, returnCase) => {
      const deliveryRefundAmount = Number(returnCase.approved_delivery_refund_amount);

      return isRefundedReturnCase(returnCase)
        ? sum + (Number.isFinite(deliveryRefundAmount) ? deliveryRefundAmount : 0)
        : sum;
    }, 0),
  );
}

function isRefundedReturnCase(returnCase: ReturnCaseRow) {
  return (
    Boolean(returnCase.stripe_refund_id) ||
    Boolean(returnCase.refunded_at) ||
    Number(returnCase.approved_refund_amount) > 0
  );
}

function formatOrderItems(items: OrderItemRow[]) {
  return items
    .map(
      (item) =>
        `${item.product_name} x${item.quantity} (${formatMoney(
          item.line_total,
        )} zł)`,
    )
    .join(" | ");
}

function getReturnCaseNumbers(returnCases: ReturnCaseRow[]) {
  return returnCases
    .map((returnCase) => `${returnCase.case_number} (${returnCase.status})`)
    .join(" | ");
}

function getLedgerOrderStatus(order: LedgerOrder) {
  const customerRefundAmount = getCustomerRefundAmount(order);
  const productsGross = getOrderProductsGross(order);

  if (order.status === "cancelled") {
    return customerRefundAmount > 0 ? "zwrócone" : "anulowane";
  }

  if (customerRefundAmount > 0 && customerRefundAmount >= productsGross) {
    return "zwrócone";
  }

  if (customerRefundAmount > 0) {
    return "częściowo zwrócone";
  }

  if (order.status === "paid") {
    return "opłacone";
  }

  if (order.status === "shipped") {
    return "wysłane";
  }

  return "nowe";
}

function getPaymentMethodLabel(
  order: Pick<OrderRow, "payment_method" | "stripe_payment_method_type">,
) {
  if (order.payment_method === "manual") {
    return "przelew";
  }

  if (order.stripe_payment_method_type === "blik") {
    return "BLIK";
  }

  if (
    order.stripe_payment_method_type === "p24" ||
    order.stripe_payment_method_type === "bank_transfer"
  ) {
    return "przelew";
  }

  return "inne";
}

function isRevenueOrder(order: Pick<OrderRow, "paid_at" | "status">) {
  return Boolean(order.paid_at) || ["paid", "shipped"].includes(order.status);
}

function getLedgerNotes(order: LedgerOrder) {
  const customerRefundAmount = getCustomerRefundAmount(order);
  const deliveryRefundAmount = getCustomerRefundDeliveryAmount(order);
  const notes = [];

  if (order.status === "cancelled") {
    notes.push("zamówienie anulowane");
  }

  if (customerRefundAmount > 0) {
    notes.push(
      `zwrot klientowi: ${formatMoney(customerRefundAmount)} zł${
        deliveryRefundAmount > 0
          ? `, w tym dostawa: ${formatMoney(deliveryRefundAmount)} zł`
          : ""
      }`,
    );
  }

  if (order.return_cases.length > 0) {
    notes.push(`sprawy zwrotów: ${getReturnCaseNumbers(order.return_cases)}`);
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
