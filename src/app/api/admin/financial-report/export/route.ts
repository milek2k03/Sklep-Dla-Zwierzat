import { NextResponse, type NextRequest } from "next/server";
import { storeBrandName } from "@/lib/brand";
import { getReturnCondition } from "@/lib/return-conditions";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ReturnCaseRow = Database["public"]["Tables"]["return_cases"]["Row"];
type ReturnCaseItemRow =
  Database["public"]["Tables"]["return_case_items"]["Row"];

type ReportOrder = OrderRow & {
  order_items: OrderItemRow[];
};
type ReportReturnCaseItem = ReturnCaseItemRow & {
  order_items: OrderItemRow | null;
};
type ReportReturnCase = ReturnCaseRow & {
  orders: Pick<
    OrderRow,
    "order_number" | "customer_full_name" | "customer_email"
  > | null;
  return_case_items: ReportReturnCaseItem[];
};

const profitStatuses = ["paid", "shipped"] as const;

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
  let ordersQuery = supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: true });
  let returnCasesQuery = supabase
    .from("return_cases")
    .select("*, orders(order_number, customer_full_name, customer_email), return_case_items(*, order_items(*))")
    .order("created_at", { ascending: true });

  if (from) {
    ordersQuery = ordersQuery.gte("created_at", `${from}T00:00:00.000Z`);
    returnCasesQuery = returnCasesQuery.gte("created_at", `${from}T00:00:00.000Z`);
  }

  if (to) {
    ordersQuery = ordersQuery.lte("created_at", `${to}T23:59:59.999Z`);
    returnCasesQuery = returnCasesQuery.lte("created_at", `${to}T23:59:59.999Z`);
  }

  const [ordersResult, returnCasesResult] = await Promise.all([
    ordersQuery,
    returnCasesQuery,
  ]);

  if (ordersResult.error) {
    return NextResponse.json(
      { error: "EXPORT_FAILED", message: ordersResult.error.message },
      { status: 500 },
    );
  }

  if (returnCasesResult.error) {
    return NextResponse.json(
      { error: "EXPORT_FAILED", message: returnCasesResult.error.message },
      { status: 500 },
    );
  }

  const orders = (ordersResult.data ?? []) as ReportOrder[];
  const returnCases = (returnCasesResult.data ?? []) as ReportReturnCase[];
  const csv = buildFinancialReportCsv({ from, orders, returnCases, to });
  const filename = getExportFilename(from, to);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildFinancialReportCsv({
  from,
  orders,
  returnCases,
  to,
}: {
  from: string | null;
  orders: ReportOrder[];
  returnCases: ReportReturnCase[];
  to: string | null;
}) {
  const summary = getFinancialSummary(orders, returnCases);
  const rows: string[][] = [
    [`Raport zyskow i strat ${storeBrandName}`],
    ["Zakres od", from ?? "poczatek"],
    ["Zakres do", to ?? "koniec"],
    ["Wygenerowano", formatDateTime(new Date().toISOString())],
    [],
    ["Podsumowanie"],
    ["Sprzedaz produktow", formatMoney(summary.salesTotal)],
    ["Koszt zakupu produktow", formatMoney(summary.purchaseCostTotal)],
    ["Czysty zysk", formatMoney(summary.netProfit)],
    ["Zwroty klientom", formatMoney(summary.customerRefundLoss)],
    ["Towar poza sprzedaza", formatMoney(summary.inventoryLoss)],
    ["Straty lacznie", formatMoney(summary.totalLoss)],
    ["Zamowienia w zakresie", String(orders.length)],
    ["Zamowienia liczone do zysku", String(summary.profitOrderCount)],
    ["Pozycje zamowien", String(summary.orderItemCount)],
    ["Sprawy zwrotow", String(returnCases.length)],
    [],
    ["Transakcje i pozycje zamowien"],
    [
      "Data zamowienia",
      "Data platnosci",
      "Numer zamowienia",
      "Status",
      "Liczone do zysku",
      "Klient",
      "E-mail",
      "Produkt slug",
      "Produkt",
      "Ilosc",
      "Cena sprzedazy szt.",
      "Sprzedaz linia",
      "Cena zakupu szt.",
      "Koszt zakupu linia",
      "Marza linia",
      "Rabat zamowienia",
      "Dostawa",
      "Razem zamowienie",
      "Metoda platnosci",
      "Stripe Payment Intent",
    ],
    ...orders.flatMap(getOrderRows),
    [],
    ["Zwroty - sprawy"],
    [
      "Data sprawy",
      "Numer sprawy",
      "Typ",
      "Status",
      "Numer zamowienia",
      "Klient",
      "E-mail",
      "Oczekiwany zwrot",
      "Zatwierdzony zwrot",
      "Stripe Refund ID",
      "Zrefundowano",
      "Notatka admina",
    ],
    ...returnCases.map(getReturnCaseRow),
    [],
    ["Zwroty - pozycje i straty magazynowe"],
    [
      "Data sprawy",
      "Numer sprawy",
      "Numer zamowienia",
      "Produkt slug",
      "Produkt",
      "Ilosc",
      "Stan zwrotu",
      "Czy strata magazynowa",
      "Cena zakupu szt.",
      "Strata magazynowa",
      "Cena sprzedazy szt.",
      "Wartosc sprzedazy zwracanej pozycji",
      "Powod utylizacji",
      "Notatka stanu",
    ],
    ...returnCases.flatMap(getReturnItemRows),
  ];

  return `\uFEFFsep=;\n${rows.map(formatCsvRow).join("\n")}\n`;
}

function getFinancialSummary(
  orders: ReportOrder[],
  returnCases: ReportReturnCase[],
) {
  const profitOrders = orders.filter((order) => isProfitOrder(order));
  const salesTotal = money(
    profitOrders.reduce(
      (total, order) =>
        total +
        order.order_items.reduce(
          (itemsTotal, item) => itemsTotal + Number(item.line_total),
          0,
        ),
      0,
    ),
  );
  const purchaseCostTotal = money(
    profitOrders.reduce(
      (total, order) =>
        total +
        order.order_items.reduce(
          (itemsTotal, item) => itemsTotal + getOrderItemPurchaseTotal(item),
          0,
        ),
      0,
    ),
  );
  const customerRefundLoss = money(
    returnCases.reduce(
      (total, returnCase) => total + Number(returnCase.approved_refund_amount),
      0,
    ),
  );
  const inventoryLoss = money(
    returnCases.reduce(
      (total, returnCase) =>
        total +
        returnCase.return_case_items
          .filter((item) => getReturnCondition(item) === "unsellable")
          .reduce(
            (itemsTotal, item) => itemsTotal + getReturnItemPurchaseLoss(item),
            0,
          ),
      0,
    ),
  );

  return {
    customerRefundLoss,
    inventoryLoss,
    netProfit: money(salesTotal - purchaseCostTotal),
    orderItemCount: orders.reduce(
      (total, order) => total + order.order_items.length,
      0,
    ),
    profitOrderCount: profitOrders.length,
    purchaseCostTotal,
    salesTotal,
    totalLoss: money(customerRefundLoss + inventoryLoss),
  };
}

function getOrderRows(order: ReportOrder) {
  if (order.order_items.length === 0) {
    return [
      [
        formatDateTime(order.created_at),
        formatDateTime(order.paid_at),
        order.order_number,
        order.status,
        isProfitOrder(order) ? "tak" : "nie",
        order.customer_full_name,
        order.customer_email,
        "",
        "",
        "0",
        formatMoney(0),
        formatMoney(0),
        formatMoney(0),
        formatMoney(0),
        formatMoney(0),
        formatMoney(order.discount_total),
        formatMoney(order.delivery_cost),
        formatMoney(order.total),
        order.payment_method,
        order.stripe_payment_intent_id ?? "",
      ],
    ];
  }

  return order.order_items.map((item) => [
    formatDateTime(order.created_at),
    formatDateTime(order.paid_at),
    order.order_number,
    order.status,
    isProfitOrder(order) ? "tak" : "nie",
    order.customer_full_name,
    order.customer_email,
    item.product_slug,
    item.product_name,
    String(item.quantity),
    formatMoney(item.unit_price),
    formatMoney(item.line_total),
    formatMoney(getOrderItemUnitPurchasePrice(item)),
    formatMoney(getOrderItemPurchaseTotal(item)),
    formatMoney(Number(item.line_total) - getOrderItemPurchaseTotal(item)),
    formatMoney(order.discount_total),
    formatMoney(order.delivery_cost),
    formatMoney(order.total),
    order.payment_method,
    order.stripe_payment_intent_id ?? "",
  ]);
}

function getReturnCaseRow(returnCase: ReportReturnCase) {
  return [
    formatDateTime(returnCase.created_at),
    returnCase.case_number,
    returnCase.case_type,
    returnCase.status,
    returnCase.orders?.order_number ?? "",
    returnCase.orders?.customer_full_name ?? "",
    returnCase.orders?.customer_email ?? "",
    formatMoney(returnCase.requested_refund_amount),
    formatMoney(returnCase.approved_refund_amount),
    returnCase.stripe_refund_id ?? "",
    formatDateTime(returnCase.refunded_at),
    returnCase.admin_notes ?? "",
  ];
}

function getReturnItemRows(returnCase: ReportReturnCase) {
  if (returnCase.return_case_items.length === 0) {
    return [
      [
        formatDateTime(returnCase.created_at),
        returnCase.case_number,
        returnCase.orders?.order_number ?? "",
        "",
        "",
        "0",
        "",
        "nie",
        formatMoney(0),
        formatMoney(0),
        formatMoney(0),
        formatMoney(0),
        "",
        "",
      ],
    ];
  }

  return returnCase.return_case_items.map((item) => {
    const isInventoryLoss = getReturnCondition(item) === "unsellable";

    return [
      formatDateTime(returnCase.created_at),
      returnCase.case_number,
      returnCase.orders?.order_number ?? "",
      item.product_slug,
      item.product_name,
      String(item.quantity),
      getReturnCondition(item),
      isInventoryLoss ? "tak" : "nie",
      formatMoney(getOrderItemUnitPurchasePrice(item.order_items)),
      formatMoney(isInventoryLoss ? getReturnItemPurchaseLoss(item) : 0),
      formatMoney(getOrderItemUnitPrice(item.order_items)),
      formatMoney(getReturnItemSalesValue(item)),
      item.disposal_reason ?? "",
      item.condition_note ?? "",
    ];
  });
}

function isProfitOrder(order: Pick<OrderRow, "status">) {
  return profitStatuses.includes(order.status as (typeof profitStatuses)[number]);
}

function getReturnItemPurchaseLoss(item: ReportReturnCaseItem) {
  return money(getOrderItemUnitPurchasePrice(item.order_items) * item.quantity);
}

function getReturnItemSalesValue(item: ReportReturnCaseItem) {
  return money(getOrderItemUnitPrice(item.order_items) * item.quantity);
}

function getOrderItemPurchaseTotal(
  item: Pick<
    OrderItemRow,
    "purchase_total" | "quantity" | "unit_purchase_price"
  > | null,
) {
  if (!item) {
    return 0;
  }

  const purchaseTotal = Number(item.purchase_total);

  if (Number.isFinite(purchaseTotal) && purchaseTotal > 0) {
    return money(purchaseTotal);
  }

  return money(getOrderItemUnitPurchasePrice(item) * item.quantity);
}

function getOrderItemUnitPurchasePrice(
  item: Pick<
    OrderItemRow,
    "purchase_total" | "quantity" | "unit_purchase_price"
  > | null,
) {
  if (!item) {
    return 0;
  }

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

function getOrderItemUnitPrice(
  item: Pick<OrderItemRow, "line_total" | "quantity" | "unit_price"> | null,
) {
  if (!item) {
    return 0;
  }

  const unitPrice = Number(item.unit_price);

  if (Number.isFinite(unitPrice) && unitPrice > 0) {
    return unitPrice;
  }

  const lineTotal = Number(item.line_total);

  if (Number.isFinite(lineTotal) && lineTotal > 0 && item.quantity > 0) {
    return lineTotal / item.quantity;
  }

  return 0;
}

function formatCsvRow(values: string[]) {
  return values.map(escapeCsvValue).join(";");
}

function escapeCsvValue(value: string) {
  const escapedValue = value.replaceAll('"', '""');

  return `"${escapedValue}"`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

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

  return `pawly-raport-zyskow-strat-${suffix}.csv`;
}
