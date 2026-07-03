import type { Database } from "@/types/supabase";

export type ExpenseCategory =
  Database["public"]["Tables"]["expense_entries"]["Row"]["category"];

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  goods: "Towar do sprzedaży",
  packaging: "Pakowanie",
  shipping: "Wysyłka / dostawy",
  stripe_fee: "Opłaty Stripe",
  refund: "Zwroty środków",
  domain: "Domena",
  hosting: "Hosting / narzędzia",
  marketing: "Marketing",
  other: "Inne",
};

export const expenseCategories = Object.keys(
  expenseCategoryLabels,
) as ExpenseCategory[];
