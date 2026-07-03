import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ExpenseInsert = Database["public"]["Tables"]["expense_entries"]["Insert"];

type RefundExpenseInput = {
  amount: number;
  orderNumber: string;
  refundId: string;
  reason?: string | null;
  returnCaseNumber?: string | null;
};

export async function recordRefundExpense({
  amount,
  orderNumber,
  reason,
  refundId,
  returnCaseNumber,
}: RefundExpenseInput) {
  if (!refundId || amount <= 0) {
    return;
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data: existingExpense, error: existingExpenseError } = await supabase
      .from("expense_entries")
      .select("id")
      .eq("category", "refund")
      .eq("document_number", refundId)
      .maybeSingle();

    if (existingExpenseError) {
      console.error("Failed to check refund expense", existingExpenseError);
      return;
    }

    if (existingExpense) {
      return;
    }

    const expense: ExpenseInsert = {
      expense_date: new Date().toISOString().slice(0, 10),
      category: "refund",
      description: returnCaseNumber
        ? `Zwrot środków ${returnCaseNumber} do zamówienia ${orderNumber}`
        : `Zwrot środków do zamówienia ${orderNumber}`,
      amount: Math.round(amount * 100) / 100,
      vendor: "Stripe",
      document_number: refundId,
      notes: reason || null,
    };

    const { error } = await supabase.from("expense_entries").insert(expense);

    if (error && error.code !== "23505") {
      console.error("Failed to record refund expense", error);
    }
  } catch (error) {
    console.error("Failed to record refund expense", error);
  }
}
