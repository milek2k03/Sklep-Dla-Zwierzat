import type { Database } from "@/types/supabase";

export type ExpenseCategory =
  Database["public"]["Tables"]["expense_entries"]["Row"]["category"];

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  goods: "Towar do sprzedaży",
  shipping: "Dostawa zakupu",
  packaging: "Opakowania",
  domain: "Domena",
  hosting: "Hosting",
  marketing: "Marketing",
  stripe_fee: "Opłaty płatnicze",
  refund: "Zwrot od dostawcy / korekta kosztu",
  other: "Inne",
};

export const expenseCategories = Object.keys(
  expenseCategoryLabels,
) as ExpenseCategory[];

type ExpenseAmountInput = {
  amount: number | string;
  category: ExpenseCategory;
};

export function isExpenseCorrection(category: ExpenseCategory) {
  return category === "refund";
}

export function getExpenseDirection(category: ExpenseCategory) {
  return isExpenseCorrection(category) ? "korekta" : "koszt";
}

export function getSignedExpenseAmount(expense: ExpenseAmountInput) {
  const amount = Math.abs(Number(expense.amount));

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return isExpenseCorrection(expense.category) ? -amount : amount;
}
