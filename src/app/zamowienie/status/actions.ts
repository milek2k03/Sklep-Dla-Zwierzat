"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendReturnCaseCreatedEmail } from "@/lib/email/order-emails";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ReturnCaseInsert = Database["public"]["Tables"]["return_cases"]["Insert"];
type ReturnCaseItemInsert =
  Database["public"]["Tables"]["return_case_items"]["Insert"];
type ReturnCaseType =
  Database["public"]["Tables"]["return_cases"]["Row"]["case_type"];

const caseTypes = [
  "return",
  "claim",
  "exchange",
] as const satisfies readonly ReturnCaseType[];

export async function createPublicReturnCaseAction(formData: FormData) {
  const orderNumber = getRequiredString(formData, "orderNumber")
    .toUpperCase()
    .slice(0, 80);
  const email = getRequiredString(formData, "email").toLowerCase().slice(0, 160);
  const caseType = getCaseType(getRequiredString(formData, "caseType"));
  const customerMessage = getRequiredString(formData, "customerMessage").slice(0, 1200);
  const redirectBase = getRedirectBase(orderNumber, email);

  if (!hasSupabaseServiceEnv()) {
    redirectWithCaseError(redirectBase, "Brak konfiguracji Supabase.");
  }

  const supabase = createSupabaseServiceClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, order_items(*)")
    .eq("order_number", orderNumber)
    .ilike("customer_email", email)
    .maybeSingle();

  if (orderError || !order) {
    redirectWithCaseError(redirectBase, "Nie znaleziono zamówienia.");
  }

  if (!["paid", "shipped"].includes(order.status)) {
    redirectWithCaseError(
      redirectBase,
      "Sprawę można zgłosić tylko dla opłaconego lub wysłanego zamówienia.",
    );
  }

  const selectedItems = order.order_items
    .map((orderItem) => {
      const quantity = getOptionalInteger(formData, `quantity:${orderItem.id}`);

      if (quantity <= 0) {
        return null;
      }

      if (quantity > orderItem.quantity) {
        redirectWithCaseError(
          redirectBase,
          `Ilość dla produktu "${orderItem.product_name}" nie może przekraczać ilości z zamówienia.`,
        );
      }

      if (quantity > 99) {
        redirectWithCaseError(
          redirectBase,
          `Ilość dla produktu "${orderItem.product_name}" jest zbyt duża.`,
        );
      }

      return {
        orderItem,
        quantity,
      };
    })
    .filter(
      (item): item is {
        orderItem: NonNullable<typeof order.order_items>[number];
        quantity: number;
      } => Boolean(item),
    );

  if (selectedItems.length === 0) {
    redirectWithCaseError(
      redirectBase,
      "Wpisz ilość przy co najmniej jednym produkcie.",
    );
  }

  const selectedOrderItemIds = selectedItems.map((item) => item.orderItem.id);
  const { data: existingReturnItem, error: existingReturnItemError } = await supabase
    .from("return_case_items")
    .select("order_item_id, product_name")
    .in("order_item_id", selectedOrderItemIds);

  if (existingReturnItemError) {
    redirectWithCaseError(redirectBase, existingReturnItemError.message);
  }

  if (existingReturnItem && existingReturnItem.length > 0) {
    const productNames = existingReturnItem
      .map((item) => item.product_name)
      .join(", ");

    redirectWithCaseError(
      redirectBase,
      `Te produkty mają już zgłoszoną sprawę: ${productNames}.`,
    );
  }

  const requestedRefundAmount =
    caseType === "exchange"
      ? 0
      : roundMoney(
          selectedItems.reduce(
            (sum, item) => sum + item.orderItem.unit_price * item.quantity,
            0,
          ),
        );
  const returnCase: ReturnCaseInsert = {
    order_id: order.id,
    case_type: caseType,
    status: "reported",
    requested_refund_amount: requestedRefundAmount,
    customer_message: customerMessage,
  };

  const { data: createdCase, error: caseError } = await supabase
    .from("return_cases")
    .insert(returnCase)
    .select("id, case_number")
    .single();

  if (caseError || !createdCase) {
    redirectWithCaseError(
      redirectBase,
      caseError?.message ?? "Nie udało się utworzyć sprawy.",
    );
  }

  const { error: itemError } = await supabase
    .from("return_case_items")
    .insert(
      selectedItems.map(({ orderItem, quantity }) => ({
        return_case_id: createdCase.id,
        order_item_id: orderItem.id,
        product_slug: orderItem.product_slug,
        product_name: orderItem.product_name,
        quantity,
        restock_action: "pending",
      }) satisfies ReturnCaseItemInsert),
    );

  if (itemError) {
    redirectWithCaseError(redirectBase, itemError.message);
  }

  const { error: eventError } = await supabase.from("order_events").insert({
    order_id: order.id,
    event_type: "return_case_created",
    actor_type: "system",
    message: `Klient zgłosił sprawę ${createdCase.case_number}.`,
    metadata: {
      returnCaseId: createdCase.id,
      caseType,
      selectedOrderItemIds,
      requestedRefundAmount,
    },
  });

  if (eventError) {
    console.error("Failed to record public return case event", eventError);
  }

  await sendReturnCaseEmailById(createdCase.id, order.id);

  revalidatePath("/admin/returns");
  revalidatePath("/zamowienie/status");
  redirect(`${redirectBase}&caseSaved=1`);
}

async function sendReturnCaseEmailById(returnCaseId: string, orderId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: returnCase, error } = await supabase
    .from("return_cases")
    .select(
      "*, orders(customer_email, customer_full_name, order_number), return_case_items(product_name, quantity)",
    )
    .eq("id", returnCaseId)
    .single();

  if (error || !returnCase) {
    console.error("Failed to fetch return case for email", error);
    return;
  }

  try {
    const emailSent = await sendReturnCaseCreatedEmail(returnCase);

    if (!emailSent) {
      return;
    }

    const { error: eventError } = await supabase.from("order_events").insert({
      order_id: orderId,
      event_type: "email_sent",
      actor_type: "system",
      message: `Wysłano e-mail potwierdzający zgłoszenie ${returnCase.case_number}.`,
      metadata: {
        returnCaseId,
        emailType: "return_case_created",
      },
    });

    if (eventError) {
      console.error("Failed to record return case email event", eventError);
    }
  } catch (error) {
    console.error("Failed to send return case created email", error);
  }
}

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Brak wartości pola ${key}.`);
  }

  return value.trim();
}

function getOptionalInteger(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return 0;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getCaseType(value: string): ReturnCaseType {
  if (caseTypes.includes(value as ReturnCaseType)) {
    return value as ReturnCaseType;
  }

  throw new Error("Niepoprawny typ sprawy.");
}

function getRedirectBase(orderNumber: string, email: string) {
  return `/zamowienie/status?order=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`;
}

function redirectWithCaseError(redirectBase: string, message: string): never {
  redirect(`${redirectBase}&caseError=${encodeURIComponent(message)}`);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
