import { NextResponse, type NextRequest } from "next/server";
import { sendRefundedOrderEmail } from "@/lib/email/order-emails";
import { getStripeClient } from "@/lib/stripe/server";
import { getAdminSession } from "@/lib/supabase/admin";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type RefundedOrder =
  Database["public"]["Tables"]["orders"]["Row"] & {
    order_items: Database["public"]["Tables"]["order_items"]["Row"][];
  };

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
      {
        error: "UNAUTHENTICATED",
        message: "Zaloguj się do panelu admina.",
      },
      { status: 401 },
    );
  }

  if (adminSession.status === "forbidden") {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Twoje konto nie ma roli admina.",
      },
      { status: 403 },
    );
  }

  let payload: unknown = null;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const reason = getStringPayloadValue(payload, "reason") ?? "Anulowanie zamówienia";
  const { id } = await context.params;
  const serverSupabase = await createSupabaseServerClient();
  const { data: currentOrder, error: currentOrderError } = await serverSupabase
    .from("orders")
    .select(
      "id, order_number, status, payment_method, subtotal, discount_total, delivery_cost, stripe_payment_intent_id, stripe_refund_id, refunded_at",
    )
    .eq("id", id)
    .single();

  if (currentOrderError || !currentOrder) {
    return NextResponse.json(
      {
        error: "ORDER_NOT_FOUND",
        message: "Nie znaleziono zamówienia.",
      },
      { status: 404 },
    );
  }

  if (currentOrder.status === "shipped") {
    return NextResponse.json(
      {
        error: "ORDER_ALREADY_SHIPPED",
        message: "Nie zwracaj automatycznie zamówienia, które zostało już wysłane.",
      },
      { status: 422 },
    );
  }

  if (currentOrder.status === "cancelled" && currentOrder.stripe_refund_id) {
    return NextResponse.json({
      order: currentOrder,
      message: "Zamówienie było już anulowane i zwrócone.",
    });
  }

  if (currentOrder.status !== "paid") {
    return NextResponse.json(
      {
        error: "ORDER_NOT_PAID",
        message: "Zwrot Stripe można wykonać tylko dla opłaconego zamówienia.",
      },
      { status: 422 },
    );
  }

  if (currentOrder.payment_method !== "stripe" || !currentOrder.stripe_payment_intent_id) {
    return NextResponse.json(
      {
        error: "ORDER_HAS_NO_STRIPE_PAYMENT",
        message: "To zamówienie nie ma płatności Stripe do zwrotu.",
      },
      { status: 422 },
    );
  }

  const stripe = getStripeClient();
  const productRefundAmount = getProductRefundAmount({
    subtotal: Number(currentOrder.subtotal),
    discountTotal: Number(currentOrder.discount_total),
  });
  let refundId: string;

  if (productRefundAmount <= 0) {
    return NextResponse.json(
      {
        error: "ORDER_HAS_NO_PRODUCT_REFUND_AMOUNT",
        message: "Zamówienie nie ma kwoty produktów do zwrotu.",
      },
      { status: 422 },
    );
  }

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: currentOrder.stripe_payment_intent_id,
        amount: toStripeAmount(productRefundAmount),
        reason: "requested_by_customer",
        metadata: {
          order_id: currentOrder.id,
          order_number: currentOrder.order_number,
          admin_user_id: adminSession.userId ?? "",
          refund_amount_without_delivery: productRefundAmount.toFixed(2),
          delivery_cost_not_refunded: Number(currentOrder.delivery_cost).toFixed(2),
        },
      },
      {
        idempotencyKey: `order-refund-${currentOrder.id}`,
      },
    );

    refundId = refund.id;
  } catch (error) {
    console.error("Failed to create Stripe refund", error);

    return NextResponse.json(
      {
        error: "STRIPE_REFUND_FAILED",
        message: "Stripe nie przyjął zwrotu płatności. Sprawdź płatność w panelu Stripe.",
      },
      { status: 502 },
    );
  }

  const supabase = createSupabaseServiceClient();
  const { error: cancelError } = await supabase
    .rpc("cancel_paid_order_after_refund", {
      p_order_id: currentOrder.id,
      p_refund_id: refundId,
      p_refund_reason: reason,
    })
    .single();

  if (cancelError) {
    console.error("Failed to cancel order after refund", cancelError);

    return NextResponse.json(
      {
        error: "ORDER_CANCEL_AFTER_REFUND_FAILED",
        message:
          "Zwrot Stripe został zlecony, ale nie udało się anulować zamówienia w bazie. Sprawdź panel Stripe i zamówienie.",
      },
      { status: 500 },
    );
  }

  const { data: refundedOrder, error: refundedOrderError } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", currentOrder.id)
    .single();

  if (refundedOrderError || !refundedOrder) {
    return NextResponse.json(
      {
        error: "ORDER_REFUNDED_BUT_NOT_FETCHED",
        message: "Zwrot zapisano, ale nie udało się pobrać zamówienia.",
      },
      { status: 500 },
    );
  }

  await recordRefundEvent({
    actorId: adminSession.userId,
    order: refundedOrder as RefundedOrder,
    productRefundAmount,
    refundId,
    reason,
  });
  await sendRefundedOrderEmailAndMark(refundedOrder as RefundedOrder);

  return NextResponse.json({ order: refundedOrder });
}

async function sendRefundedOrderEmailAndMark(order: RefundedOrder) {
  try {
    const emailSent = await sendRefundedOrderEmail(order);

    if (!emailSent) {
      return;
    }

    const sentAt = new Date().toISOString();
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("orders")
      .update({ refund_email_sent_at: sentAt })
      .eq("id", order.id);

    if (error) {
      console.error("Failed to store refund email timestamp", error);
      return;
    }

    const { error: eventError } = await supabase.from("order_events").insert({
      order_id: order.id,
      event_type: "email_sent",
      actor_type: "system",
      message: "Wysłano e-mail z informacją o anulowaniu i zwrocie.",
      metadata: {
        stripeRefundId: order.stripe_refund_id,
        refundReason: order.refund_reason,
      },
    });

    if (eventError) {
      console.error("Failed to record refund email event", eventError);
    }
  } catch (error) {
    console.error("Failed to send refund email", error);
  }
}

async function recordRefundEvent({
  actorId,
  order,
  productRefundAmount,
  reason,
  refundId,
}: {
  actorId: string | null;
  order: RefundedOrder;
  productRefundAmount: number;
  reason: string;
  refundId: string;
}) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("order_events").insert({
    order_id: order.id,
    event_type: "refund_created",
    from_status: "paid",
    to_status: "cancelled",
    actor_type: "admin",
    actor_id: actorId,
    message: "Zlecono zwrot Stripe, anulowano zamówienie i przywrócono magazyn.",
    metadata: {
      stripeRefundId: refundId,
      refundReason: reason,
      productRefundAmount,
      deliveryCostNotRefunded: order.delivery_cost,
      totalPaid: order.total,
    },
  });

  if (error) {
    console.error("Failed to record refund event", error);
  }
}

function getProductRefundAmount({
  discountTotal,
  subtotal,
}: {
  discountTotal: number;
  subtotal: number;
}) {
  return Math.round(Math.max(0, subtotal - discountTotal) * 100) / 100;
}

function toStripeAmount(value: number) {
  return Math.round(value * 100);
}

function getStringPayloadValue(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue.slice(0, 500) : null;
}
