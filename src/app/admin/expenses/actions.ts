"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { expenseCategories, type ExpenseCategory } from "@/lib/expenses";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ExpenseInsert = Database["public"]["Tables"]["expense_entries"]["Insert"];

export async function createExpenseAction(formData: FormData) {
  await requireAdmin();

  let expense: ExpenseInsert;

  try {
    expense = parseExpenseForm(formData);
  } catch (error) {
    redirect(
      `/admin/expenses?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Niepoprawne dane kosztu.",
      )}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("expense_entries").insert(expense);

  if (error) {
    redirect(`/admin/expenses?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/expenses");
  redirect("/admin/expenses?saved=created");
}

export async function deleteExpenseAction(formData: FormData) {
  await requireAdmin();

  const id = getRequiredString(formData, "id");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("expense_entries").delete().eq("id", id);

  if (error) {
    redirect(`/admin/expenses?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/expenses");
  redirect("/admin/expenses?saved=deleted");
}

async function requireAdmin() {
  const adminSession = await getAdminSession();

  if (adminSession.status !== "admin") {
    redirect("/admin/login");
  }
}

function parseExpenseForm(formData: FormData): ExpenseInsert {
  const category = getRequiredString(formData, "category") as ExpenseCategory;

  if (!expenseCategories.includes(category)) {
    throw new Error("Niepoprawna kategoria kosztu.");
  }

  return {
    expense_date: getDate(formData, "expenseDate"),
    category,
    description: getRequiredString(formData, "description"),
    amount: getRequiredAmount(formData, "amount"),
    vendor: getOptionalString(formData, "vendor") || null,
    document_number: getOptionalString(formData, "documentNumber") || null,
    document_url: getOptionalString(formData, "documentUrl") || null,
    notes: getOptionalString(formData, "notes") || null,
  };
}

function getDate(formData: FormData, key: string) {
  const value = getRequiredString(formData, key);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Pole ${key} musi być poprawną datą.`);
  }

  return value;
}

function getRequiredAmount(formData: FormData, key: string) {
  const rawValue = getRequiredString(formData, key).replace(",", ".");
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Pole ${key} musi być kwotą większą od 0.`);
  }

  return Math.round(value * 100) / 100;
}

function getRequiredString(formData: FormData, key: string) {
  const value = getOptionalString(formData, key);

  if (!value) {
    throw new Error(`Pole ${key} jest wymagane.`);
  }

  return value;
}

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
