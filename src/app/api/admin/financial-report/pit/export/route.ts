import { NextResponse, type NextRequest } from "next/server";
import {
  expenseCategoryLabels,
  expensePaymentMethodLabels,
  getExpenseDirection,
  isExpenseCorrection,
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
    | "id"
    | "order_number"
    | "customer_full_name"
    | "customer_email"
    | "subtotal"
    | "discount_total"
    | "delivery_cost"
    | "total"
  > | null;
  return_case_items: PitReturnCaseItem[];
};
type CustomerReturnRecord = {
  amount: number;
  condition: string;
  customer: string;
  date: string;
  deliveryRefunded: boolean;
  moneyReturnedAt: string | null;
  notes: string;
  orderId: string;
  orderNumber: string;
  reason: string;
  returnToStock: string;
  status: string;
};

const profitStatuses = ["paid", "shipped"] as const;
const unregisteredActivityQuarterlyLimit2026 = 10813.5;
const limitWarningRatio = 0.8;

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
  const [ordersResult, returnCasesResult, expensesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: true }),
    supabase
      .from("return_cases")
      .select(
        "*, orders(id, order_number, customer_full_name, customer_email, subtotal, discount_total, delivery_cost, total), return_case_items(*, order_items(*))",
      )
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

  const allOrders = (ordersResult.data ?? []) as PitOrder[];
  const allReturnCases = (returnCasesResult.data ?? []) as PitReturnCase[];
  const orders = allOrders.filter((order) =>
    isDateInRange(getOrderSaleDate(order), from, to),
  );
  const returnCases = allReturnCases.filter((returnCase) =>
    isDateInRange(getReturnCaseCorrectionDate(returnCase), from, to),
  );
  const customerReturns = getCustomerReturnRecords({
    allOrders,
    allReturnCases,
    from,
    returnCases,
    to,
  });
  const csv = buildUnregisteredActivityCsv({
    customerReturns,
    expenses: expensesResult.expenses,
    from,
    orders,
    returnCases,
    to,
  });
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

function buildUnregisteredActivityCsv({
  customerReturns,
  expenses,
  from,
  orders,
  returnCases,
  to,
}: {
  customerReturns: CustomerReturnRecord[];
  expenses: ExpenseRow[];
  from: string | null;
  orders: PitOrder[];
  returnCases: PitReturnCase[];
  to: string | null;
}) {
  const positiveExpenses = expenses.filter(
    (expense) => !isExpenseCorrection(expense.category),
  );
  const costCorrections = expenses.filter((expense) =>
    isExpenseCorrection(expense.category),
  );
  const summary = getPitSummary({
    customerReturns,
    expenses,
    orders,
    returnCases,
  });
  const returnAmountByOrderId = getReturnAmountByOrderId(customerReturns);
  const rows: string[][] = [
    ["EWIDENCJA DZIAŁALNOŚCI NIEREJESTROWANEJ"],
    ["Zakres od", from ?? "początek"],
    ["Zakres do", to ?? "koniec"],
    ["Wygenerowano", formatDateTime(new Date().toISOString())],
    [
      "Założenie limitu 2026",
      `${formatMoney(unregisteredActivityQuarterlyLimit2026)} zł kwartalnie`,
      "225% minimalnego wynagrodzenia; sprawdź aktualny limit dla innego roku.",
    ],
    [
      "Uwaga",
      "Raport pomocniczy. Do PIT-36 przenosisz przychód, koszty i dochód albo stratę; koszty muszą być udokumentowane.",
    ],
    [],
    ["1. EWIDENCJA PRZYCHODU / SPRZEDAŻY"],
    [
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
    ],
    ...getSalesRows(orders, returnAmountByOrderId),
    [],
    ["2. ZWROTY KLIENTÓW"],
    [
      "Data zwrotu",
      "Numer zamówienia",
      "Klient",
      "Kwota zwrotu",
      "Czy zwrócono koszt dostawy",
      "Powód zwrotu",
      "Stan produktu",
      "Czy wraca na magazyn",
      "Data zwrotu pieniędzy",
      "Status zwrotu",
      "Uwagi",
    ],
    ...customerReturns.map(getCustomerReturnRow),
    [],
    ["Kontrola przychodu po zwrotach"],
    ["Sprzedaż brutto", formatMoney(summary.revenueBeforeCorrections)],
    ["Zwroty klientów", `-${formatMoney(summary.customerRefundCorrections)}`],
    ["Przychód po zwrotach", formatMoney(summary.pitRevenue)],
    [],
    ["3. EWIDENCJA KOSZTÓW"],
    [
      "Lp.",
      "Data kosztu",
      "Kategoria",
      "Opis",
      "Kwota brutto",
      "Sprzedawca",
      "Numer dokumentu / faktury",
      "Metoda płatności",
      "Uwagi",
    ],
    ...positiveExpenses.map(getExpenseRow),
    [],
    ["4. KOREKTY KOSZTÓW"],
    ["Data", "Kategoria", "Opis", "Kwota", "Typ", "Uwagi"],
    ...costCorrections.map(getCostCorrectionRow),
    [],
    ["5. PODSUMOWANIE DOCHODU"],
    ["Sprzedaż brutto", formatMoney(summary.revenueBeforeCorrections)],
    ["Zwroty klientów", `-${formatMoney(summary.customerRefundCorrections)}`],
    ["Przychód po zwrotach", formatMoney(summary.pitRevenue)],
    ["Koszty dodatnie", formatMoney(summary.positiveCosts)],
    ["Korekty kosztów od dostawców", `-${formatMoney(summary.costCorrections)}`],
    ["Koszty razem", formatMoney(summary.totalCosts)],
    ["Dochód", formatMoney(Math.max(0, summary.income))],
    ["Strata", formatMoney(Math.max(0, -summary.income))],
    [],
    ["6. LIMIT DZIAŁALNOŚCI NIEREJESTROWANEJ"],
    [
      "Okres",
      "Przychód",
      "Limit",
      "Wykorzystanie %",
      "Pozostało do limitu",
      "Ostrzeżenie",
    ],
    ...getCurrentLimitRows(orders, customerReturns),
    [],
    ["Zestawienie miesięczne"],
    ["Miesiąc", "Przychód po korektach"],
    ...getMonthlyRows(orders, customerReturns),
    [],
    ["Zestawienie kwartalne"],
    [
      "Rok",
      "Kwartał",
      "Przychód po korektach",
      "Limit",
      "Wykorzystanie %",
      "Pozostało do limitu",
      "Status",
    ],
    ...getQuarterRows(orders, customerReturns),
    [],
    ["7. FINALNE LICZBY DO PIT-36"],
    ["Przychód", formatMoney(summary.pitRevenue)],
    ["Koszty", formatMoney(summary.totalCosts)],
    ["Dochód", formatMoney(Math.max(0, summary.income))],
    ["Strata", formatMoney(Math.max(0, -summary.income))],
    [],
    ["Informacyjnie - nie przenosić drugi raz do kosztów"],
    ["Koszt zakupu sprzedanych produktów z katalogu", formatMoney(summary.productPurchaseCosts)],
    ["Strata magazynowa / utylizacja", formatMoney(summary.inventoryLoss)],
    [
      "Zasada",
      "Produkt zwrócony przez klienta, który idzie do śmieci, nie tworzy drugiego kosztu; oznaczasz go jako stratę magazynową / utylizację.",
    ],
    [],
    ["8. NAJWAŻNIEJSZE ZASADY"],
    ...[
      "Sprzedaż klientowi zwiększa przychód.",
      "Zwrot pieniędzy klientowi zmniejsza przychód.",
      "Zwrot klientowi nie jest kosztem.",
      "Zakup towaru zwiększa koszty.",
      "Zakup domeny zwiększa koszty.",
      "Zakup opakowań zwiększa koszty.",
      "Reklama zwiększa koszty.",
      "Zwrot pieniędzy od dostawcy zmniejsza koszty.",
      "Nie mieszam zwrotów klientów z kosztami.",
      "Nie mieszam zwrotów od dostawcy ze zwrotami klientów.",
    ].map((rule) => [rule]),
  ];

  return `\uFEFFsep=;\n${rows.map(formatCsvRow).join("\n")}\n`;
}

function getSalesRows(
  orders: PitOrder[],
  returnAmountByOrderId: Map<string, number>,
) {
  let runningTotal = 0;

  return orders.map((order, index) => {
    runningTotal = money(runningTotal + getRecognizedOrderRevenue(order));

    return [
      String(index + 1),
      formatDateTime(getOrderSaleDate(order)),
      order.order_number,
      order.customer_full_name,
      getOrderItemsDescription(order.order_items),
      formatMoney(getOrderProductsGross(order)),
      formatMoney(order.delivery_cost),
      formatMoney(order.total),
      getPaymentMethodLabel(order.payment_method),
      getOrderReportStatus(order, returnAmountByOrderId.get(order.id) ?? 0),
      formatMoney(runningTotal),
      getOrderNotes(order),
    ];
  });
}

function getExpenseRow(expense: ExpenseRow, index: number) {
  return [
    String(index + 1),
    formatDate(expense.expense_date),
    expenseCategoryLabels[expense.category],
    expense.description,
    formatMoney(Number(expense.amount)),
    expense.vendor ?? "",
    expense.document_number ?? "",
    expensePaymentMethodLabels[expense.payment_method],
    expense.notes ?? "",
  ];
}

function getCostCorrectionRow(expense: ExpenseRow) {
  return [
    formatDate(expense.expense_date),
    expenseCategoryLabels[expense.category],
    expense.description,
    formatMoney(Number(expense.amount)),
    getExpenseDirection(expense.category),
    expense.notes ?? "",
  ];
}

function getCustomerReturnRow(record: CustomerReturnRecord) {
  return [
    formatDateTime(record.date),
    record.orderNumber,
    record.customer,
    formatMoney(record.amount),
    record.deliveryRefunded ? "tak" : "nie",
    record.reason,
    record.condition,
    record.returnToStock,
    formatDateTime(record.moneyReturnedAt),
    record.status,
    record.notes,
  ];
}

function getCustomerReturnRecords({
  allOrders,
  allReturnCases,
  from,
  returnCases,
  to,
}: {
  allOrders: PitOrder[];
  allReturnCases: PitReturnCase[];
  from: string | null;
  returnCases: PitReturnCase[];
  to: string | null;
}) {
  const returnCaseOrderIds = new Set(
    allReturnCases.map((returnCase) => returnCase.order_id),
  );
  const returnCaseRecords = returnCases.map((returnCase) =>
    getReturnCaseRecord(returnCase),
  );
  const directOrderRefunds = allOrders
    .filter(
      (order) =>
        order.stripe_refund_id &&
        !returnCaseOrderIds.has(order.id) &&
        isDateInRange(order.refunded_at ?? order.updated_at, from, to),
    )
    .map(getDirectOrderRefundRecord);

  return [...returnCaseRecords, ...directOrderRefunds].sort(
    (first, second) =>
      new Date(first.date).getTime() - new Date(second.date).getTime(),
  );
}

function getReturnCaseRecord(returnCase: PitReturnCase): CustomerReturnRecord {
  const order = returnCase.orders;
  const amount = money(Number(returnCase.approved_refund_amount));

  return {
    amount,
    condition: getReturnCaseConditionLabel(returnCase),
    customer: order?.customer_full_name ?? "",
    date: getReturnCaseCorrectionDate(returnCase),
    deliveryRefunded: order ? amount > getOrderProductsGross(order) : false,
    moneyReturnedAt: returnCase.refunded_at,
    notes: [returnCase.case_number, returnCase.admin_notes, returnCase.stripe_refund_id]
      .filter(Boolean)
      .join(" | "),
    orderId: returnCase.order_id,
    orderNumber: order?.order_number ?? "",
    reason: returnCase.customer_message ?? returnCase.admin_notes ?? "",
    returnToStock: getReturnCaseStockLabel(returnCase),
    status: getReturnStatusLabel(returnCase),
  };
}

function getDirectOrderRefundRecord(order: PitOrder): CustomerReturnRecord {
  const amount = getOrderFullRefundCorrection(order);

  return {
    amount,
    condition: "wraca na magazyn",
    customer: order.customer_full_name,
    date: order.refunded_at ?? order.updated_at,
    deliveryRefunded: amount > getOrderProductsGross(order),
    moneyReturnedAt: order.refunded_at,
    notes: [order.refund_reason, order.stripe_refund_id].filter(Boolean).join(" | "),
    orderId: order.id,
    orderNumber: order.order_number,
    reason: order.refund_reason ?? "Anulowanie zamówienia",
    returnToStock: "tak",
    status: "zwrócono środki",
  };
}

function getPitSummary({
  customerReturns,
  expenses,
  orders,
  returnCases,
}: {
  customerReturns: CustomerReturnRecord[];
  expenses: ExpenseRow[];
  orders: PitOrder[];
  returnCases: PitReturnCase[];
}) {
  const profitOrders = orders.filter(isProfitOrder);
  const revenueBeforeCorrections = money(
    profitOrders.reduce((sum, order) => sum + Number(order.total), 0),
  );
  const customerRefundCorrections = money(
    customerReturns.reduce((sum, record) => sum + record.amount, 0),
  );
  const positiveCosts = money(
    expenses
      .filter((expense) => !isExpenseCorrection(expense.category))
      .reduce((sum, expense) => sum + Math.abs(Number(expense.amount)), 0),
  );
  const costCorrections = money(
    expenses
      .filter((expense) => isExpenseCorrection(expense.category))
      .reduce((sum, expense) => sum + Math.abs(Number(expense.amount)), 0),
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
  const totalCosts = money(Math.max(0, positiveCosts - costCorrections));
  const income = money(pitRevenue - totalCosts);

  return {
    costCorrections,
    customerRefundCorrections,
    income,
    inventoryLoss,
    pitRevenue,
    positiveCosts,
    productPurchaseCosts,
    revenueBeforeCorrections,
    totalCosts,
  };
}

function getCurrentLimitRows(
  orders: PitOrder[],
  customerReturns: CustomerReturnRecord[],
) {
  const today = getWarsawDateKey(new Date());
  const currentMonth = today.slice(0, 7);
  const currentQuarter = getDatePeriod(`${today}T00:00:00.000Z`, "quarter");
  const monthlyRevenue = getPeriodNetRevenueBuckets(
    orders,
    customerReturns,
    "month",
  ).get(currentMonth) ?? 0;
  const quarterlyRevenue = getPeriodNetRevenueBuckets(
    orders,
    customerReturns,
    "quarter",
  ).get(currentQuarter) ?? 0;
  const [year] = currentQuarter.split("-Q");
  const limit = getQuarterLimit(year);

  return [
    [
      "Bieżący miesiąc",
      formatMoney(monthlyRevenue),
      "",
      "",
      "",
      "informacyjnie - w 2026 limit jest kwartalny",
    ],
    getLimitRow("Bieżący kwartał", quarterlyRevenue, limit),
  ];
}

function getMonthlyRows(
  orders: PitOrder[],
  customerReturns: CustomerReturnRecord[],
) {
  const buckets = getPeriodNetRevenueBuckets(orders, customerReturns, "month");

  return [...buckets.entries()].map(([period, value]) => [
    period,
    formatMoney(value),
  ]);
}

function getQuarterRows(
  orders: PitOrder[],
  customerReturns: CustomerReturnRecord[],
) {
  const buckets = getPeriodNetRevenueBuckets(orders, customerReturns, "quarter");

  return [...buckets.entries()].map(([period, value]) => {
    const [year, quarter] = period.split("-Q");
    const limit = getQuarterLimit(year);
    const limitData = getLimitData(value, limit);

    return [
      year,
      `Q${quarter}`,
      formatMoney(value),
      limit === null ? "" : formatMoney(limit),
      limitData.usage,
      limitData.remaining,
      limitData.status,
    ];
  });
}

function getLimitRow(label: string, revenue: number, limit: number | null) {
  const limitData = getLimitData(revenue, limit);

  return [
    label,
    formatMoney(revenue),
    limit === null ? "" : formatMoney(limit),
    limitData.usage,
    limitData.remaining,
    limitData.status,
  ];
}

function getLimitData(revenue: number, limit: number | null) {
  if (limit === null) {
    return {
      remaining: "",
      status: "sprawdź limit dla tego roku",
      usage: "",
    };
  }

  const usageRatio = limit > 0 ? revenue / limit : 0;
  const remaining = Math.max(0, limit - revenue);

  return {
    remaining: formatMoney(remaining),
    status:
      revenue > limit
        ? "przekroczony"
        : usageRatio >= limitWarningRatio
          ? "zbliżasz się do limitu"
          : "ok",
    usage: `${Math.round(usageRatio * 1000) / 10}%`,
  };
}

function getPeriodNetRevenueBuckets(
  orders: PitOrder[],
  customerReturns: CustomerReturnRecord[],
  periodType: "month" | "quarter",
) {
  const salesBuckets = getOrderRevenueBuckets(orders, periodType);
  const returnBuckets = getReturnCorrectionBuckets(customerReturns, periodType);
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

function getOrderRevenueBuckets(
  orders: PitOrder[],
  periodType: "month" | "quarter",
) {
  return orders.filter(isProfitOrder).reduce((buckets, order) => {
    const period = getDatePeriod(getOrderSaleDate(order), periodType);
    buckets.set(period, money((buckets.get(period) ?? 0) + Number(order.total)));

    return buckets;
  }, new Map<string, number>());
}

function getReturnCorrectionBuckets(
  customerReturns: CustomerReturnRecord[],
  periodType: "month" | "quarter",
) {
  return customerReturns.reduce((buckets, record) => {
    const period = getDatePeriod(record.date, periodType);
    buckets.set(period, money((buckets.get(period) ?? 0) + record.amount));

    return buckets;
  }, new Map<string, number>());
}

function getReturnAmountByOrderId(customerReturns: CustomerReturnRecord[]) {
  return customerReturns.reduce((amounts, record) => {
    amounts.set(record.orderId, money((amounts.get(record.orderId) ?? 0) + record.amount));

    return amounts;
  }, new Map<string, number>());
}

function getOrderReportStatus(order: PitOrder, refundAmount: number) {
  const productsGross = getOrderProductsGross(order);

  if (order.status === "cancelled") {
    return refundAmount > 0 ? "zwrócone" : "anulowane";
  }

  if (refundAmount > 0 && refundAmount >= productsGross) {
    return "zwrócone";
  }

  if (refundAmount > 0) {
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

function getReturnStatusLabel(returnCase: PitReturnCase) {
  if (returnCase.status === "reported") {
    return "zgłoszony";
  }

  if (returnCase.status === "awaiting_package") {
    return "oczekuje na paczkę";
  }

  if (returnCase.status === "package_received") {
    return "paczka otrzymana";
  }

  if (returnCase.status === "rejected") {
    return "odrzucony";
  }

  if (
    returnCase.refunded_at ||
    returnCase.stripe_refund_id ||
    Number(returnCase.approved_refund_amount) > 0
  ) {
    return "zwrócono środki";
  }

  return "paczka otrzymana";
}

function getReturnCaseConditionLabel(returnCase: PitReturnCase) {
  const conditions = returnCase.return_case_items.map((item) =>
    getReturnCondition(item),
  );

  if (conditions.length === 0 || conditions.includes("needs_review")) {
    return "wymaga sprawdzenia";
  }

  if (conditions.every((condition) => condition === "sellable")) {
    return "wraca na magazyn";
  }

  if (conditions.every((condition) => condition === "unsellable")) {
    return "nie wraca na magazyn / do utylizacji";
  }

  return "częściowo wraca na magazyn";
}

function getReturnCaseStockLabel(returnCase: PitReturnCase) {
  const conditions = returnCase.return_case_items.map((item) =>
    getReturnCondition(item),
  );

  if (conditions.length === 0 || conditions.includes("needs_review")) {
    return "wymaga sprawdzenia";
  }

  if (conditions.every((condition) => condition === "sellable")) {
    return "tak";
  }

  if (conditions.every((condition) => condition === "unsellable")) {
    return "nie";
  }

  return "częściowo";
}

function getOrderNotes(order: PitOrder) {
  const notes = [];

  if (order.discount_code) {
    notes.push(`kod rabatowy: ${order.discount_code}`);
  }

  if (order.stripe_refund_id) {
    notes.push(`zwrot Stripe: ${order.stripe_refund_id}`);
  }

  if (order.notes) {
    notes.push(order.notes);
  }

  return notes.join("; ");
}

function getPaymentMethodLabel(paymentMethod: OrderRow["payment_method"]) {
  if (paymentMethod === "manual") {
    return "przelew";
  }

  return "inne";
}

function getRecognizedOrderRevenue(order: PitOrder) {
  if (!isProfitOrder(order)) {
    return 0;
  }

  return Number(order.total);
}

function isProfitOrder(order: Pick<OrderRow, "paid_at" | "status">) {
  return (
    Boolean(order.paid_at) ||
    profitStatuses.includes(order.status as (typeof profitStatuses)[number])
  );
}

function getOrderFullRefundCorrection(order: PitOrder) {
  if (!order.stripe_refund_id) {
    return 0;
  }

  return getOrderProductsGross(order);
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

function getOrderProductsGross(
  order: Pick<OrderRow, "discount_total" | "subtotal">,
) {
  return money(
    Math.max(0, Number(order.subtotal) - Number(order.discount_total)),
  );
}

function getOrderItemsDescription(items: OrderItemRow[]) {
  return items.map((item) => `${item.product_name} x${item.quantity}`).join(" | ");
}

function getOrderSaleDate(order: Pick<OrderRow, "created_at" | "paid_at">) {
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

function getQuarterLimit(year: string) {
  if (year === "2026") {
    return unregisteredActivityQuarterlyLimit2026;
  }

  return null;
}

function getWarsawDateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
  }).format(date);
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

  return `pawly-ewidencja-dzialalnosci-nierejestrowanej-${suffix}.csv`;
}
