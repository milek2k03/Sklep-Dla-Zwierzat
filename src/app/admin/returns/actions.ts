"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  sendReturnCaseClosedEmail,
  sendReturnCaseCreatedEmail,
  sendReturnCaseStatusEmail,
} from "@/lib/email/order-emails";
import {
  getRestockActionForCondition,
  getReturnToStock,
  returnConditions,
  type ReturnCondition,
} from "@/lib/return-conditions";
import { getStripeClient } from "@/lib/stripe/server";
import { getAdminSession } from "@/lib/supabase/admin";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ReturnCaseInsert = Database["public"]["Tables"]["return_cases"]["Insert"];
type ReturnCaseItemInsert =
  Database["public"]["Tables"]["return_case_items"]["Insert"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ReturnCaseRow = Database["public"]["Tables"]["return_cases"]["Row"];
type ReturnCaseItemRow =
  Database["public"]["Tables"]["return_case_items"]["Row"];

const caseTypes = ["return", "claim", "exchange"] as const;
const caseStatuses = [
  "reported",
  "awaiting_package",
  "package_received",
  "accepted",
  "rejected",
  "closed",
] as const;

export async function createReturnCaseAction(formData: FormData) {
  const adminSession = await requireAdmin();
  const orderId = getRequiredString(formData, "orderId");
  const caseType = getEnumValue(
    getRequiredString(formData, "caseType"),
    caseTypes,
    "Niepoprawny typ sprawy.",
  );
  const requestedRefundAmount = getOptionalMoney(formData, "requestedRefundAmount") ?? 0;
  const customerMessage = getOptionalString(formData, "customerMessage");
  const adminNotes = getOptionalString(formData, "adminNotes");
  const supabase = await createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, order_items(*)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    redirect("/admin/returns?error=Nie znaleziono zamówienia.");
  }

  if (!["paid", "shipped"].includes(order.status)) {
    redirect(
      `/admin/returns/new?order=${orderId}&error=Sprawę można utworzyć tylko dla opłaconego lub wysłanego zamówienia.`,
    );
  }

  const selectedItems = order.order_items
    .map((item) => {
      const quantity = getOptionalInteger(formData, `quantity:${item.id}`) ?? 0;

      if (quantity <= 0) {
        return null;
      }

      if (quantity > item.quantity) {
        throw new Error("Ilość zwracana nie może przekraczać ilości z zamówienia.");
      }

      return {
        order_item_id: item.id,
        product_slug: item.product_slug,
        product_name: item.product_name,
        quantity,
      };
    })
    .filter((item): item is Omit<ReturnCaseItemInsert, "return_case_id"> =>
      Boolean(item),
    );

  if (selectedItems.length === 0) {
    redirect(
      `/admin/returns/new?order=${orderId}&error=Wybierz co najmniej jeden produkt.`,
    );
  }

  const selectedOrderItemIds = selectedItems.map((item) => item.order_item_id);
  const { data: existingReturnItems, error: existingReturnItemsError } =
    await supabase
      .from("return_case_items")
      .select("order_item_id, product_name, return_cases(case_number, status)")
      .in("order_item_id", selectedOrderItemIds);

  if (existingReturnItemsError) {
    redirect(
      `/admin/returns/new?order=${orderId}&error=${encodeURIComponent(existingReturnItemsError.message)}`,
    );
  }

  if (existingReturnItems && existingReturnItems.length > 0) {
    const productNames = existingReturnItems
      .map((item) => item.product_name)
      .join(", ");

    redirect(
      `/admin/returns?error=${encodeURIComponent(
        `Nie można utworzyć drugiej sprawy dla tych samych produktów: ${productNames}.`,
      )}`,
    );
  }

  const returnCase: ReturnCaseInsert = {
    order_id: orderId,
    case_type: caseType,
    status: "reported",
    requested_refund_amount: requestedRefundAmount,
    customer_message: customerMessage || null,
    admin_notes: adminNotes || null,
  };
  const { data: createdCase, error: caseError } = await supabase
    .from("return_cases")
    .insert(returnCase)
    .select("id, case_number")
    .single();

  if (caseError || !createdCase) {
    redirect(`/admin/returns/new?order=${orderId}&error=${encodeURIComponent(caseError?.message ?? "Nie udało się utworzyć sprawy.")}`);
  }

  const { error: itemsError } = await supabase.from("return_case_items").insert(
    selectedItems.map((item) => ({
      ...item,
      return_case_id: createdCase.id,
    })),
  );

  if (itemsError) {
    redirect(`/admin/returns?error=${encodeURIComponent(itemsError.message)}`);
  }

  await recordReturnCaseEvent({
    actorId: adminSession.userId,
    orderId,
    eventType: "return_case_created",
    message: `Utworzono sprawę ${createdCase.case_number}.`,
    metadata: {
      returnCaseId: createdCase.id,
      caseType,
      requestedRefundAmount,
    },
  });

  await sendReturnCaseCustomerEmail({
    actorId: adminSession.userId,
    emailType: "return_case_created",
    orderId,
    returnCaseId: createdCase.id,
  });

  revalidateReturnPaths();
  redirect("/admin/returns?saved=created");
}

export async function updateReturnCaseStatusAction(formData: FormData) {
  const adminSession = await requireAdmin();
  const caseId = getRequiredString(formData, "caseId");
  const status = getEnumValue(
    getRequiredString(formData, "status"),
    caseStatuses,
    "Niepoprawny status sprawy.",
  );

  if (status === "closed") {
    redirect("/admin/returns?error=Zamknij sprawę przez sekcję decyzji magazynowej.");
  }

  const adminNotes = getOptionalString(formData, "adminNotes");
  const supabase = await createSupabaseServerClient();
  const { data: updatedCase, error } = await supabase
    .from("return_cases")
    .update({
      status,
      admin_notes: adminNotes || null,
    })
    .eq("id", caseId)
    .select("id, case_number, order_id")
    .single();

  if (error || !updatedCase) {
    redirect(`/admin/returns?error=${encodeURIComponent(error?.message ?? "Nie udało się zapisać sprawy.")}`);
  }

  await recordReturnCaseEvent({
    actorId: adminSession.userId,
    orderId: updatedCase.order_id,
    eventType: "return_case_updated",
    message: `Zmieniono status sprawy ${updatedCase.case_number}.`,
    metadata: {
      returnCaseId: updatedCase.id,
      status,
    },
  });

  await sendReturnCaseCustomerEmail({
    actorId: adminSession.userId,
    emailType: "return_case_status",
    orderId: updatedCase.order_id,
    returnCaseId: updatedCase.id,
  });

  revalidateReturnPaths();
  redirect("/admin/returns?saved=updated");
}

export async function closeReturnCaseAction(formData: FormData) {
  const adminSession = await requireAdmin();
  const caseId = getRequiredString(formData, "caseId");
  const submittedStatus = getEnumValue(
    getRequiredString(formData, "status"),
    caseStatuses,
    "Niepoprawny status sprawy.",
  );
  const submittedAdminNotes = getOptionalString(formData, "adminNotes");
  const approvedProductRefundAmount =
    getOptionalMoney(formData, "approvedProductRefundAmount") ??
    getOptionalMoney(formData, "approvedRefundAmount") ??
    0;
  const approvedDeliveryRefundAmount =
    getOptionalMoney(formData, "approvedDeliveryRefundAmount") ?? 0;
  const approvedRefundAmount = roundMoney(
    approvedProductRefundAmount + approvedDeliveryRefundAmount,
  );
  const supabase = await createSupabaseServerClient();
  const { data: returnCase, error } = await supabase
    .from("return_cases")
    .select("*, orders(*), return_case_items(*, order_items(unit_price, line_total, quantity))")
    .eq("id", caseId)
    .single();

  if (error || !returnCase) {
    redirect(`/admin/returns?error=${encodeURIComponent(error?.message ?? "Nie znaleziono sprawy.")}`);
  }

  if (submittedStatus !== "accepted" && submittedStatus !== "rejected") {
    redirect(
      "/admin/returns?error=Sprawę można zamknąć tylko po statusie Zaakceptowane albo Odrzucone.",
    );
  }

  if (approvedRefundAmount > 0 && submittedStatus !== "accepted") {
    redirect(
      "/admin/returns?error=Zwrot płatności można wykonać tylko dla zaakceptowanej sprawy.",
    );
  }

  const caseItems = returnCase.return_case_items as ReturnCaseItemRow[];
  const maxProductRefundAmount = calculateReturnProductsTotal(
    returnCase.return_case_items as Array<
      ReturnCaseItemRow & {
        order_items?: {
          unit_price: number;
          line_total: number;
          quantity: number;
        } | null;
      }
    >,
  );

  if (approvedProductRefundAmount > maxProductRefundAmount) {
    redirect(
      `/admin/returns?error=${encodeURIComponent(
        `Zwrot za produkty nie może przekraczać ${maxProductRefundAmount.toFixed(2)} zł.`,
      )}`,
    );
  }

  const order = returnCase.orders as OrderRow | null;
  const maxDeliveryRefundAmount = order ? roundMoney(Number(order.delivery_cost)) : 0;

  if (approvedDeliveryRefundAmount > maxDeliveryRefundAmount) {
    redirect(
      `/admin/returns?error=${encodeURIComponent(
        `Zwrot dostawy nie może przekraczać ${maxDeliveryRefundAmount.toFixed(2)} zł.`,
      )}`,
    );
  }

  const itemDecisions = caseItems.map((item) => {
    const returnCondition = getEnumValue(
      getRequiredString(formData, `returnCondition:${item.id}`),
      returnConditions,
      "Niepoprawna decyzja magazynowa.",
    ) as ReturnCondition;
    const disposalReason =
      returnCondition === "unsellable"
        ? getOptionalString(formData, `disposalReason:${item.id}`)
        : null;

    if (returnCondition === "needs_review") {
      redirect(
        "/admin/returns?error=Przed zamknięciem sprawy wybierz, czy produkt wraca na magazyn albo oznacz go jako niewracający.",
      );
    }

    if (returnCondition === "unsellable" && !disposalReason) {
      redirect(
        "/admin/returns?error=Dla produktów niewracających na magazyn wpisz powód.",
      );
    }

    return {
      id: item.id,
      disposalReason,
      restockAction: getRestockActionForCondition(returnCondition),
      returnCondition,
      returnToStock: getReturnToStock(returnCondition),
    };
  });

  if (
    returnCase.status !== submittedStatus ||
    (returnCase.admin_notes ?? "") !== submittedAdminNotes
  ) {
    const { error: statusUpdateError } = await supabase
      .from("return_cases")
      .update({
        status: submittedStatus,
        admin_notes: submittedAdminNotes || null,
      })
      .eq("id", caseId);

    if (statusUpdateError) {
      redirect(`/admin/returns?error=${encodeURIComponent(statusUpdateError.message)}`);
    }

    await recordReturnCaseEvent({
      actorId: adminSession.userId,
      orderId: returnCase.order_id,
      eventType: "return_case_updated",
      message: `Zmieniono status sprawy ${returnCase.case_number}.`,
      metadata: {
        returnCaseId: returnCase.id,
        status: submittedStatus,
      },
    });
  }

  const itemUpdates = await Promise.all(
    itemDecisions.map((decision) =>
      supabase
        .from("return_case_items")
        .update({
          restock_action: decision.restockAction,
          return_condition: decision.returnCondition,
          return_to_stock: decision.returnToStock,
          disposal_reason: decision.disposalReason,
          condition_note: decision.disposalReason,
        })
        .eq("id", decision.id),
    ),
  );
  const itemUpdateError = itemUpdates.find((result) => result.error)?.error;

  if (itemUpdateError) {
    redirect(`/admin/returns?error=${encodeURIComponent(itemUpdateError.message)}`);
  }

  let refundId: string | null = null;

  if (approvedRefundAmount > 0 && order) {
    try {
      refundId = await createPartialRefund({
        amount: approvedRefundAmount,
        deliveryAmount: approvedDeliveryRefundAmount,
        order,
        productAmount: approvedProductRefundAmount,
        returnCase,
      });
    } catch (error) {
      redirect(
        `/admin/returns?error=${encodeURIComponent(
          getRefundErrorMessage(error),
        )}`,
      );
    }
  }
  const serviceSupabase = createSupabaseServiceClient();
  const { error: completeError } = await serviceSupabase
    .rpc("complete_return_case", {
      p_return_case_id: caseId,
      p_refund_id: refundId,
      p_refund_amount: approvedRefundAmount,
      p_delivery_refund_amount: approvedDeliveryRefundAmount,
    })
    .single();

  if (completeError) {
    redirect(`/admin/returns?error=${encodeURIComponent(completeError.message)}`);
  }

  await recordReturnCaseEvent({
    actorId: adminSession.userId,
    orderId: returnCase.order_id,
    eventType: "return_case_closed",
    message: `Zamknięto sprawę ${returnCase.case_number}.`,
    metadata: {
      returnCaseId: returnCase.id,
      approvedRefundAmount,
      approvedProductRefundAmount,
      approvedDeliveryRefundAmount,
      stripeRefundId: refundId,
    },
  });

  if (refundId) {
    await recordReturnCaseEvent({
      actorId: adminSession.userId,
      orderId: returnCase.order_id,
      eventType: "refund_created",
      message: `Zlecono częściowy zwrot dla sprawy ${returnCase.case_number}.`,
      metadata: {
        returnCaseId: returnCase.id,
        approvedRefundAmount,
        approvedProductRefundAmount,
        approvedDeliveryRefundAmount,
        stripeRefundId: refundId,
      },
    });
  }

  await sendReturnCaseCustomerEmail({
    actorId: adminSession.userId,
    emailType: "return_case_closed",
    orderId: returnCase.order_id,
    returnCaseId: returnCase.id,
  });

  revalidateReturnPaths();
  redirect("/admin/returns?saved=closed");
}

async function createPartialRefund({
  amount,
  deliveryAmount,
  order,
  productAmount,
  returnCase,
}: {
  amount: number;
  deliveryAmount: number;
  order: OrderRow;
  productAmount: number;
  returnCase: ReturnCaseRow;
}) {
  if (order.payment_method !== "stripe" || !order.stripe_payment_intent_id) {
    throw new Error("Zamówienie nie ma płatności Stripe do zwrotu.");
  }

  if (amount > Number(order.total)) {
    throw new Error("Zwrot nie może przekraczać wartości zamówienia.");
  }

  const stripe = getStripeClient();
  const refund = await stripe.refunds.create(
    {
      payment_intent: order.stripe_payment_intent_id,
      amount: Math.round(amount * 100),
      reason: "requested_by_customer",
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        return_case_id: returnCase.id,
        return_case_number: returnCase.case_number,
        refund_amount: amount.toFixed(2),
        refund_products_total: productAmount.toFixed(2),
        refund_delivery_total: deliveryAmount.toFixed(2),
      },
    },
    {
      idempotencyKey: `return-case-refund-${returnCase.id}`,
    },
  );

  return refund.id;
}

function getRefundErrorMessage(error: unknown) {
  const stripeError = error as {
    code?: string;
    message?: string;
    statusCode?: number;
    type?: string;
  };

  if (stripeError.type === "StripeConnectionError") {
    return "Nie udało się połączyć ze Stripe i potwierdzić zwrotu. Sprawdź połączenie z internetem/DNS/VPN albo spróbuj ponownie za chwilę.";
  }

  if (stripeError.type === "StripeAuthenticationError") {
    return "Stripe odrzucił klucz API. Sprawdź STRIPE_SECRET_KEY w konfiguracji.";
  }

  if (stripeError.type === "StripePermissionError") {
    return "Stripe nie pozwolił wykonać zwrotu dla tego konta lub klucza API.";
  }

  if (stripeError.type === "StripeInvalidRequestError" && stripeError.message) {
    return `Stripe odrzucił zwrot: ${stripeError.message}`;
  }

  return error instanceof Error
    ? error.message
    : "Nie udało się zlecić zwrotu Stripe.";
}

async function requireAdmin() {
  const adminSession = await getAdminSession();

  if (adminSession.status !== "admin") {
    redirect("/admin/login");
  }

  return adminSession;
}

async function recordReturnCaseEvent({
  actorId,
  eventType,
  message,
  metadata,
  orderId,
}: {
  actorId: string | null;
  eventType:
    | "return_case_created"
    | "return_case_updated"
    | "return_case_closed"
    | "refund_created"
    | "email_sent";
  message: string;
  metadata: Database["public"]["Tables"]["order_events"]["Insert"]["metadata"];
  orderId: string;
}) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: eventType,
    actor_type: "admin",
    actor_id: actorId,
    message,
    metadata,
  });

  if (error) {
    console.error("Failed to record return case event", error);
  }
}

async function sendReturnCaseCustomerEmail({
  actorId,
  emailType,
  orderId,
  returnCaseId,
}: {
  actorId: string | null;
  emailType: "return_case_created" | "return_case_status" | "return_case_closed";
  orderId: string;
  returnCaseId: string;
}) {
  const supabase = createSupabaseServiceClient();
  const { data: returnCase, error } = await supabase
    .from("return_cases")
    .select(
      "*, orders(customer_email, customer_full_name, order_number), return_case_items(product_name, quantity)",
    )
    .eq("id", returnCaseId)
    .single();

  if (error || !returnCase) {
    console.error("Failed to fetch return case for customer email", error);
    return;
  }

  try {
    const emailSent =
      emailType === "return_case_created"
        ? await sendReturnCaseCreatedEmail(returnCase)
        : emailType === "return_case_closed"
          ? await sendReturnCaseClosedEmail(returnCase)
          : await sendReturnCaseStatusEmail(returnCase);

    if (!emailSent) {
      return;
    }

    await recordReturnCaseEvent({
      actorId,
      orderId,
      eventType: "email_sent",
      message: `Wysłano e-mail klienta dla sprawy ${returnCase.case_number}.`,
      metadata: {
        returnCaseId,
        emailType,
      },
    });
  } catch (error) {
    console.error("Failed to send return case customer email", error);
  }
}

function revalidateReturnPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/returns");
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

function getOptionalMoney(formData: FormData, key: string) {
  const value = getOptionalString(formData, key).replace(",", ".");

  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`Pole ${key} musi być kwotą większą lub równą 0.`);
  }

  return roundMoney(numberValue);
}

function roundMoney(value: number) {
  return Math.round(Number(value) * 100) / 100;
}

function calculateReturnProductsTotal(
  items: Array<
    ReturnCaseItemRow & {
      order_items?: {
        unit_price: number;
        line_total: number;
        quantity: number;
      } | null;
    }
  >,
) {
  return Math.round(
    items.reduce((total, item) => {
      const unitPrice =
        item.order_items?.unit_price !== undefined
          ? Number(item.order_items.unit_price)
          : item.order_items?.line_total && item.order_items.quantity
            ? Number(item.order_items.line_total) / item.order_items.quantity
            : 0;

      return total + unitPrice * item.quantity;
    }, 0) * 100,
  ) / 100;
}

function getOptionalInteger(formData: FormData, key: string) {
  const value = getOptionalString(formData, key);

  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue)) {
    throw new Error(`Pole ${key} musi być liczbą całkowitą.`);
  }

  return numberValue;
}

function getEnumValue<const Values extends readonly string[]>(
  value: string,
  values: Values,
  message: string,
) {
  if (!values.includes(value)) {
    throw new Error(message);
  }

  return value as Values[number];
}
