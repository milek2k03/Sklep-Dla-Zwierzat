import { NextResponse, type NextRequest } from "next/server";
import {
  expenseCategoryLabels,
  getSignedExpenseAmount,
} from "@/lib/expenses";
import { getReturnCondition } from "@/lib/return-conditions";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ExpenseRow = Database["public"]["Tables"]["expense_entries"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ReturnCaseRow = Database["public"]["Tables"]["return_cases"]["Row"];
type ReturnCaseItemRow =
  Database["public"]["Tables"]["return_case_items"]["Row"];

type PitOrder = OrderRow & {
  order_items: OrderItemRow[];
};
type PitReturnCaseItem = ReturnCaseItemRow & {
  order_items: OrderItemRow | null;
};
type PitReturnCase = ReturnCaseRow & {
  orders: Pick<
    OrderRow,
    "order_number" | "customer_full_name" | "customer_email"
  > | null;
  return_case_items: PitReturnCaseItem[];
};

const profitStatuses = ["paid", "shipped"] as const;
const unregisteredActivityQuarterlyLimit2026 = 10813.5;

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
  const [ordersResult, returnCasesResult, expensesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ["paid", "shipped", "cancelled"])
      .order("created_at", { ascending: true }),
    supabase
      .from("return_cases")
      .select("*, orders(order_number, customer_full_name, customer_email), return_case_items(*, order_items(*))")
      .order("created_at", { ascending: true }),
    getExpenses(supabase, from, to),
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

  if (expensesResult.error) {
    return NextResponse.json(
      { error: "EXPORT_FAILED", message: expensesResult.error.message },
      { status: 500 },
    );
  }

  const orders = ((ordersResult.data ?? []) as PitOrder[]).filter((order) =>
    isDateInRange(getOrderRevenueDate(order), from, to),
  );
  const returnCases = ((returnCasesResult.data ?? []) as PitReturnCase[]).filter(
    (returnCase) => isDateInRange(getReturnCaseCorrectionDate(returnCase), from, to),
  );
  const expenses = expensesResult.expenses;
  const csv = buildPitCsv({ expenses, from, orders, returnCases, to });
  const filename = getExportFilename(from, to);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function getExpenses(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  from: string | null,
  to: string | null,
) {
  let query = supabase
    .from("expense_entries")
    .select("*")
    .order("expense_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (from) {
    query = query.gte("expense_date", from);
  }

  if (to) {
    query = query.lte("expense_date", to);
  }

  const { data, error } = await query;

  return {
    error,
    expenses: (data ?? []) as ExpenseRow[],
  };
}

function buildPitCsv({
  expenses,
  from,
  orders,
  returnCases,
  to,
}: {
  expenses: ExpenseRow[];
  from: string | null;
  orders: PitOrder[];
  returnCases: PitReturnCase[];
  to: string | null;
}) {
  const summary = getPitSummary(orders, returnCases, expenses);
  const rows: string[][] = [
    ["Raport PIT-36 - dzialalnosc nierejestrowana"],
    ["Zakres od", from ?? "poczatek"],
    ["Zakres do", to ?? "koniec"],
    ["Wygenerowano", formatDateTime(new Date().toISOString())],
    [
      "Uwaga",
      "Raport pomocniczy. Do PIT-36 wpisujesz przychody, koszty i dochod/strate z wiersza dzialalnosc nierejestrowana; koszty musza byc udokumentowane.",
    ],
    [
      "Uwaga o kosztach",
      "Domyslne koszty nie dubluja kategorii Towar do sprzedazy z ewidencji kosztow, bo koszt towaru jest liczony z cen zakupu produktow.",
    ],
    [],
    ["Kwoty do PIT-36"],
    ["Pole", "Kwota", "Opis"],
    [
      "Przychod",
      formatMoney(summary.pitRevenue),
      "Kwoty otrzymane od klientow po odjeciu zwrotow/refundow",
    ],
    [
      "Koszty uzyskania przychodow",
      formatMoney(summary.defaultPitCosts),
      "Koszt zakupu sprzedanych produktow + pozostale koszty z ewidencji",
    ],
    [
      "Dochod",
      formatMoney(Math.max(0, summary.defaultPitIncome)),
      "Przychod minus koszty, jesli wynik jest dodatni",
    ],
    [
      "Strata",
      formatMoney(Math.max(0, -summary.defaultPitIncome)),
      "Koszty minus przychod, jesli wynik jest ujemny",
    ],
    [
      "Zaliczki",
      formatMoney(0),
      "Dzialalnosc nierejestrowana zwykle nie wymaga zaliczek w trakcie roku",
    ],
    [],
    ["Kontrola kosztow"],
    ["Pozycja", "Kwota"],
    ["Przychod przed korektami", formatMoney(summary.revenueBeforeCorrections)],
    ["Zwroty/refundy klientom", formatMoney(summary.customerRefundCorrections)],
    ["Koszt zakupu sprzedanych produktow", formatMoney(summary.productPurchaseCosts)],
    ["Koszty z ewidencji - Towar do sprzedazy", formatMoney(summary.goodsExpenses)],
    ["Koszty z ewidencji - pozostale", formatMoney(summary.otherExpenses)],
    ["Koszty z ewidencji - razem", formatMoney(summary.expenseLedgerCosts)],
    ["Towar poza sprzedaza", formatMoney(summary.inventoryLoss)],
    [],
    ["Kontrola limitu dzialalnosci nierejestrowanej"],
    ["Rok", "Kwartal", "Przychod po korektach", "Limit 2026", "Status"],
    ...getQuarterRows(orders, returnCases),
    [],
    ["Miesieczne zestawienie przychodu"],
    ["Miesiac", "Przychod przed korektami", "Korekty/refundy", "Przychod po korektach"],
    ...getMonthlyRows(orders, returnCases),
    [],
    ["Transakcje"],
    [
      "Data",
      "Numer zamowienia",
      "Status",
      "Klient",
      "E-mail",
      "Przychod brutto",
      "Rabat",
      "Dostawa",
      "Koszt zakupu produktow",
      "Dochod przed innymi kosztami",
    ],
    ...orders.map(getOrderRow),
    [],
    ["Koszty z ewidencji"],
    [
      "Data",
      "Kategoria",
      "Opis",
      "Kwota",
      "Kwota ze znakiem",
      "Sprzedawca",
      "Numer dokumentu",
      "Link dokumentu",
      "Uwagi",
    ],
    ...expenses.map(getExpenseRow),
    [],
    ["Zwroty i korekty przychodu"],
    [
      "Data korekty",
      "Numer sprawy",
      "Numer zamowienia",
      "Klient",
      "Zatwierdzony zwrot",
      "Towar poza sprzedaza",
      "Stripe Refund ID",
      "Status sprawy",
    ],
    ...returnCases.map(getReturnCaseRow),
  ];

  return `\uFEFFsep=;\n${rows.map(formatCsvRow).join("\n")}\n`;
}

function getPitSummary(
  orders: PitOrder[],
  returnCases: PitReturnCase[],
  expenses: ExpenseRow[],
) {
  const profitOrders = orders.filter(isProfitOrder);
  const revenueBeforeCorrections = money(
    profitOrders.reduce((sum, order) => sum + Number(order.total), 0),
  );
  const customerRefundCorrections = money(
    returnCases.reduce(
      (sum, returnCase) => sum + Number(returnCase.approved_refund_amount),
      0,
    ) +
      orders
        .filter((order) => isProfitOrder(order) && order.stripe_refund_id)
        .reduce((sum, order) => sum + getOrderFullRefundCorrection(order), 0),
  );
  const productPurchaseCosts = money(
    profitOrders.reduce(
      (sum, order) =>
        sum +
        order.order_items.reduce(
          (itemsSum, item) => itemsSum + getOrderItemPurchaseTotal(item),
          0,
        ),
      0,
    ),
  );
  const goodsExpenses = money(
    expenses
      .filter((expense) => expense.category === "goods")
      .reduce((sum, expense) => sum + getSignedExpenseAmount(expense), 0),
  );
  const otherExpenses = money(
    expenses
      .filter((expense) => expense.category !== "goods")
      .reduce((sum, expense) => sum + getSignedExpenseAmount(expense), 0),
  );
  const expenseLedgerCosts = money(goodsExpenses + otherExpenses);
  const inventoryLoss = money(
    returnCases.reduce((sum, returnCase) => {
      return (
        sum +
        returnCase.return_case_items
          .filter((item) => getReturnCondition(item) === "unsellable")
          .reduce(
            (itemsSum, item) => itemsSum + getReturnItemPurchaseLoss(item),
            0,
          )
      );
    }, 0),
  );
  const pitRevenue = money(
    Math.max(0, revenueBeforeCorrections - customerRefundCorrections),
  );
  const defaultPitCosts = money(productPurchaseCosts + otherExpenses);
  const defaultPitIncome = money(pitRevenue - defaultPitCosts);

  return {
    customerRefundCorrections,
    defaultPitCosts,
    defaultPitIncome,
    expenseLedgerCosts,
    goodsExpenses,
    inventoryLoss,
    otherExpenses,
    pitRevenue,
    productPurchaseCosts,
    revenueBeforeCorrections,
  };
}

function getQuarterRows(orders: PitOrder[], returnCases: PitReturnCase[]) {
  const buckets = getPeriodBuckets(orders, returnCases, "quarter");

  return [...buckets.entries()].map(([period, value]) => {
    const [year, quarter] = period.split("-Q");
    const limit =
      year === "2026" ? unregisteredActivityQuarterlyLimit2026 : null;
    const status =
      limit === null
        ? "sprawdz limit dla tego roku"
        : value > limit
          ? "przekroczony"
          : "ok";

    return [
      year,
      `Q${quarter}`,
      formatMoney(value),
      limit === null ? "" : formatMoney(limit),
      status,
    ];
  });
}

function getMonthlyRows(orders: PitOrder[], returnCases: PitReturnCase[]) {
  const revenueBuckets = getOrderRevenueBuckets(orders, "month");
  const correctionBuckets = getReturnCorrectionBuckets(returnCases, "month");
  const periods = [...new Set([...revenueBuckets.keys(), ...correctionBuckets.keys()])].sort();

  return periods.map((period) => {
    const revenue = revenueBuckets.get(period) ?? 0;
    const corrections = correctionBuckets.get(period) ?? 0;

    return [
      period,
      formatMoney(revenue),
      formatMoney(corrections),
      formatMoney(Math.max(0, revenue - corrections)),
    ];
  });
}

function getPeriodBuckets(
  orders: PitOrder[],
  returnCases: PitReturnCase[],
  periodType: "month" | "quarter",
) {
  const revenueBuckets = getOrderRevenueBuckets(orders, periodType);
  const correctionBuckets = getReturnCorrectionBuckets(returnCases, periodType);
  const periods = [...new Set([...revenueBuckets.keys(), ...correctionBuckets.keys()])].sort();
  const buckets = new Map<string, number>();

  periods.forEach((period) => {
    buckets.set(
      period,
      money(
        Math.max(
          0,
          (revenueBuckets.get(period) ?? 0) - (correctionBuckets.get(period) ?? 0),
        ),
      ),
    );
  });

  return buckets;
}

function getOrderRevenueBuckets(
  orders: PitOrder[],
  periodType: "month" | "quarter",
) {
  return orders.filter(isProfitOrder).reduce((buckets, order) => {
    const period = getDatePeriod(getOrderRevenueDate(order), periodType);
    buckets.set(period, money((buckets.get(period) ?? 0) + Number(order.total)));

    return buckets;
  }, new Map<string, number>());
}

function getReturnCorrectionBuckets(
  returnCases: PitReturnCase[],
  periodType: "month" | "quarter",
) {
  return returnCases.reduce((buckets, returnCase) => {
    const period = getDatePeriod(getReturnCaseCorrectionDate(returnCase), periodType);
    buckets.set(
      period,
      money(
        (buckets.get(period) ?? 0) +
          Number(returnCase.approved_refund_amount),
      ),
    );

    return buckets;
  }, new Map<string, number>());
}

function getOrderRow(order: PitOrder) {
  const purchaseCosts = money(
    order.order_items.reduce(
      (sum, item) => sum + getOrderItemPurchaseTotal(item),
      0,
    ),
  );

  return [
    formatDateTime(getOrderRevenueDate(order)),
    order.order_number,
    order.status,
    order.customer_full_name,
    order.customer_email,
    formatMoney(isProfitOrder(order) ? Number(order.total) : 0),
    formatMoney(order.discount_total),
    formatMoney(order.delivery_cost),
    formatMoney(purchaseCosts),
    formatMoney(isProfitOrder(order) ? Number(order.total) - purchaseCosts : 0),
  ];
}

function getExpenseRow(expense: ExpenseRow) {
  return [
    formatDate(expense.expense_date),
    expenseCategoryLabels[expense.category],
    expense.description,
    formatMoney(Number(expense.amount)),
    formatMoney(getSignedExpenseAmount(expense)),
    expense.vendor ?? "",
    expense.document_number ?? "",
    expense.document_url ?? "",
    expense.notes ?? "",
  ];
}

function getReturnCaseRow(returnCase: PitReturnCase) {
  const inventoryLoss = money(
    returnCase.return_case_items
      .filter((item) => getReturnCondition(item) === "unsellable")
      .reduce((sum, item) => sum + getReturnItemPurchaseLoss(item), 0),
  );

  return [
    formatDateTime(getReturnCaseCorrectionDate(returnCase)),
    returnCase.case_number,
    returnCase.orders?.order_number ?? "",
    returnCase.orders?.customer_full_name ?? "",
    formatMoney(returnCase.approved_refund_amount),
    formatMoney(inventoryLoss),
    returnCase.stripe_refund_id ?? "",
    returnCase.status,
  ];
}

function isProfitOrder(order: Pick<OrderRow, "status">) {
  return profitStatuses.includes(order.status as (typeof profitStatuses)[number]);
}

function getOrderFullRefundCorrection(order: PitOrder) {
  if (!order.stripe_refund_id) {
    return 0;
  }

  return money(Math.max(0, Number(order.subtotal) - Number(order.discount_total)));
}

function getReturnItemPurchaseLoss(item: PitReturnCaseItem) {
  return money(getOrderItemUnitPurchasePrice(item.order_items) * item.quantity);
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

function getOrderRevenueDate(order: Pick<OrderRow, "created_at" | "paid_at">) {
  return order.paid_at ?? order.created_at;
}

function getReturnCaseCorrectionDate(
  returnCase: Pick<ReturnCaseRow, "created_at" | "refunded_at" | "updated_at">,
) {
  return returnCase.refunded_at ?? returnCase.updated_at ?? returnCase.created_at;
}

function isDateInRange(value: string, from: string | null, to: string | null) {
  const date = value.slice(0, 10);

  if (from && date < from) {
    return false;
  }

  if (to && date > to) {
    return false;
  }

  return true;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${value}T00:00:00.000Z`));
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

  return `pawly-pit36-dzialalnosc-nierejestrowana-${suffix}.csv`;
}
