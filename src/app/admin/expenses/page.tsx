import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  FileSpreadsheet,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { deleteExpenseAction } from "@/app/admin/expenses/actions";
import { ExpenseForm } from "@/components/admin/ExpenseForm";
import {
  expenseCategoryLabels,
  getExpenseDirection,
  getSignedExpenseAmount,
  isExpenseCorrection,
} from "@/lib/expenses";
import { formatPrice } from "@/lib/format";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const metadata: Metadata = {
  title: "Koszty admin | Pawly",
};

export const dynamic = "force-dynamic";

type ExpenseRow = Database["public"]["Tables"]["expense_entries"]["Row"];

type AdminExpensesPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    saved?: string | string[];
  }>;
};

export default async function AdminExpensesPage({
  searchParams,
}: AdminExpensesPageProps) {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (adminSession.status !== "admin") {
    redirect("/admin");
  }

  const [resolvedSearchParams, expensesResult] = await Promise.all([
    searchParams,
    getExpenses(),
  ]);
  const error = getFirstSearchParam(resolvedSearchParams.error);
  const saved = getFirstSearchParam(resolvedSearchParams.saved);
  const expenses = expensesResult.expenses;
  const total = expenses.reduce(
    (sum, expense) => sum + getSignedExpenseAmount(expense),
    0,
  );
  const currentMonth = getCurrentMonth();
  const currentMonthTotal = expenses
    .filter((expense) => expense.expense_date.startsWith(currentMonth))
    .reduce((sum, expense) => sum + getSignedExpenseAmount(expense), 0);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f5a52] transition hover:text-[#1f1f1f]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Wróć do zamówień
            </Link>
            <p className="mt-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#9b6f39]">
              <ReceiptText className="h-4 w-4" aria-hidden="true" />
              Uproszczona ewidencja
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
              Koszty Pawly
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6d675f]">
              Zapisuj wydatki związane ze sklepem: towar, opakowania, wysyłkę,
              domenę, hosting, marketing i opłaty płatnicze. Zwrot od dostawcy
              albo operatora wpisuj jako korektę kosztu. Zwroty pieniędzy
              klientom są korektą przychodu w zamówieniach, nie kosztem.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <MetricCard label="Ten miesiąc" value={formatPrice(currentMonthTotal)} />
            <MetricCard label="Razem w tabeli" value={formatPrice(total)} />
          </div>
        </div>
      </div>

      {saved ? (
        <div className="mt-6 rounded-lg border border-[#cfe8d2] bg-[#ecf8ee] p-4 text-sm font-semibold text-[#2f6b3f]">
          {saved === "deleted" ? "Usunięto koszt." : "Dodano koszt do ewidencji."}
        </div>
      ) : null}

      {error || expensesResult.error ? (
        <div className="mt-6 rounded-lg border border-[#f3cbbd] bg-[#fff1e8] p-4 text-sm font-semibold text-[#a64022]">
          {error
            ? `Nie udało się zapisać kosztu: ${error}`
            : `Nie udało się pobrać kosztów: ${expensesResult.error}`}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)] xl:items-start">
        <aside className="rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-24">
          <ExpenseForm today={getToday()} />
        </aside>

        <div className="overflow-hidden rounded-lg border border-[#eee7db] bg-white shadow-sm">
          <div className="border-b border-[#eee7db] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#1f1f1f]">
                  Lista kosztów
                </h2>
                <p className="mt-1 text-sm text-[#6d675f]">
                  Ostatnie 100 wpisów, najnowsze na górze.
                </p>
              </div>
              <Link
                href="/api/admin/expenses/export"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                Eksport CSV
              </Link>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
                <ReceiptText className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-[#1f1f1f]">
                Brak kosztów
              </h3>
              <p className="mt-2 text-sm text-[#6d675f]">
                Dodaj pierwszy wydatek, gdy kupisz towar, opakowania albo usługę
                dla sklepu.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#eee7db]">
              {expenses.map((expense) => (
                <ExpenseListItem key={expense.id} expense={expense} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ExpenseListItem({ expense }: { expense: ExpenseRow }) {
  const signedAmount = getSignedExpenseAmount(expense);
  const isCorrection = isExpenseCorrection(expense.category);

  return (
    <article className="grid gap-4 p-4 md:grid-cols-[130px_minmax(0,1fr)_170px_auto] md:items-center sm:p-5">
      <div className="text-sm">
        <p className="font-semibold text-[#1f1f1f]">
          {formatDate(expense.expense_date)}
        </p>
        <p className="mt-1 text-xs text-[#6d675f]">
          {expenseCategoryLabels[expense.category]}
        </p>
        {isCorrection ? (
          <span className="mt-2 inline-flex rounded-full bg-[#eef8ed] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#2f6b3f]">
            {getExpenseDirection(expense.category)}
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-[#1f1f1f]">
          {expense.description}
        </h3>
        <p className="mt-1 truncate text-sm text-[#6d675f]">
          {[expense.vendor, expense.document_number]
            .filter(Boolean)
            .join(" • ") || "Brak sprzedawcy / numeru dokumentu"}
        </p>
        {expense.notes ? (
          <p className="mt-1 line-clamp-2 text-sm text-[#7a746d]">
            {expense.notes}
          </p>
        ) : null}
      </div>
      <div className="text-sm md:text-right">
        <p
          className={
            isCorrection
              ? "text-lg font-semibold text-[#2f6b3f]"
              : "text-lg font-semibold text-[#1f1f1f]"
          }
        >
          {formatPrice(signedAmount)}
        </p>
        {expense.document_url ? (
          <a
            href={expense.document_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex text-xs font-semibold text-[#5f5a52] underline-offset-4 hover:text-[#1f1f1f] hover:underline"
          >
            Dokument
          </a>
        ) : null}
      </div>
      <form action={deleteExpenseAction}>
        <input type="hidden" name="id" value={expense.id} />
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#f3cbbd] px-4 text-sm font-semibold text-[#a64022] transition hover:border-[#a64022]"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Usuń
        </button>
      </form>
    </article>
  );
}

async function getExpenses() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("expense_entries")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    expenses: (data ?? []) as ExpenseRow[],
    error: error?.message ?? null,
  };
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#1f1f1f] px-4 py-3 text-white">
      <p className="text-xs text-white/62">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getToday() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

function getCurrentMonth() {
  return getToday().slice(0, 7);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
