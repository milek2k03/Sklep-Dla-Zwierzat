import { NextResponse, type NextRequest } from "next/server";
import {
  expenseCategoryLabels,
  getExpenseDirection,
  getSignedExpenseAmount,
} from "@/lib/expenses";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ExpenseRow = Database["public"]["Tables"]["expense_entries"]["Row"];

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

  if (error) {
    return NextResponse.json(
      { error: "EXPORT_FAILED", message: error.message },
      { status: 500 },
    );
  }

  const csv = buildExpensesCsv((data ?? []) as ExpenseRow[]);
  const filename = getExportFilename(from, to);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildExpensesCsv(expenses: ExpenseRow[]) {
  const headers = [
    "Lp.",
    "Data kosztu",
    "Kategoria",
    "Typ",
    "Opis",
    "Kwota brutto",
    "Wartość rzeczywista",
    "Sprzedawca",
    "Numer dokumentu",
    "Link dokumentu",
    "Uwagi",
    "Suma narastająco",
  ];
  let runningTotal = 0;
  const rows = expenses.map((expense, index) => {
    const signedAmount = getSignedExpenseAmount(expense);
    runningTotal = money(runningTotal + signedAmount);

    return [
      String(index + 1),
      formatDate(expense.expense_date),
      expenseCategoryLabels[expense.category],
      getExpenseDirection(expense.category),
      expense.description,
      formatMoney(Number(expense.amount)),
      formatMoney(signedAmount),
      expense.vendor ?? "",
      expense.document_number ?? "",
      expense.document_url ?? "",
      expense.notes ?? "",
      formatMoney(runningTotal),
    ];
  });

  return `\uFEFF${[headers, ...rows].map(formatCsvRow).join("\n")}\n`;
}

function formatCsvRow(values: string[]) {
  return values.map(escapeCsvValue).join(";");
}

function escapeCsvValue(value: string) {
  const escapedValue = value.replaceAll('"', '""');

  return `"${escapedValue}"`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatMoney(value: number) {
  return money(value).toFixed(2);
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

  return `pawly-ewidencja-kosztow-${suffix}.csv`;
}
