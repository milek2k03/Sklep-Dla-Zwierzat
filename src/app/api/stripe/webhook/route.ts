import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { sendPaidOrderEmails } from "@/lib/email/order-emails";
import { recordRefundExpense } from "@/lib/refund-expenses";
import { getStripeWebhookSecret } from "@/lib/stripe/env";
import { getStripeClient } from "@/lib/stripe/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type PaidOrderRow = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items: Database["public"]["Tables"]["order_items"]["Row"][];
};

export async function POST(request: NextRequest) {
  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      { error: "SUPABASE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "MISSING_STRIPE_SIGNATURE" },
      { status: 400 },
    );
  }

  const stripe = getStripeClient();
  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);

    return NextResponse.json(
      { error: "INVALID_STRIPE_SIGNATURE" },
      { status: 400 },
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await markOrderAsPaid(event.data.object as Stripe.Checkout.Session);
  }

  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    await cancelOrderAndRestoreStock(
      event.data.object as Stripe.Checkout.Session,
      event.type,
    );
  }

  if (event.type === "refund.created") {
    await recordStripeRefundExpense(event.data.object as Stripe.Refund);
  }

  return NextResponse.json({ received: true });
}

async function markOrderAsPaid(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    return;
  }

  const orderId = session.metadata?.order_id;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const supabase = createSupabaseServiceClient();
  const update = {
    status: "paid" as const,
    payment_method: "stripe" as const,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    paid_at: new Date().toISOString(),
  };
  let updateQuery = supabase
    .from("orders")
    .update(update)
    .neq("status", "paid")
    .neq("status", "cancelled")
    .is("stock_restored_at", null);

  updateQuery = orderId
    ? updateQuery.eq("id", orderId)
    : updateQuery.eq("stripe_checkout_session_id", session.id);

  const { data: updatedOrder, error } = await updateQuery
    .select("*, order_items(*)")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return;
    }

    console.error("Failed to mark Stripe order as paid", error);
    return;
  }

  if (!updatedOrder) {
    return;
  }

  await recordOrderEvent({
    orderId: updatedOrder.id,
    eventType: "payment_paid",
    toStatus: "paid",
    actorType: "stripe",
    message: "Płatność Stripe została potwierdzona.",
    metadata: {
      checkoutSessionId: session.id,
      paymentIntentId,
    },
  });

  await sendPaidOrderEmailsAndMark(updatedOrder as PaidOrderRow);
}

async function sendPaidOrderEmailsAndMark(order: PaidOrderRow) {
  try {
    const result = await sendPaidOrderEmails(order);
    const update: Database["public"]["Tables"]["orders"]["Update"] = {};
    const sentAt = new Date().toISOString();

    if (result.customerEmailSent) {
      update.customer_email_sent_at = sentAt;
    }

    if (result.adminEmailSent) {
      update.admin_email_sent_at = sentAt;
    }

    if (Object.keys(update).length === 0) {
      return;
    }

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order.id);

    if (error) {
      console.error("Failed to store order email timestamps", error);
      return;
    }

    await recordOrderEvent({
      orderId: order.id,
      eventType: "email_sent",
      actorType: "system",
      message: "Wysłano e-mail po opłaceniu zamówienia.",
      metadata: update,
    });
  } catch (error) {
    console.error("Failed to send paid order emails", error);
  }
}

async function cancelOrderAndRestoreStock(
  session: Stripe.Checkout.Session,
  eventType: Stripe.Event.Type,
) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc("cancel_order_and_restore_stock", {
      p_order_id: session.metadata?.order_id ?? null,
      p_checkout_session_id: session.id,
    })
    .single();

  if (error) {
    console.error("Failed to cancel Stripe order and restore stock", error);
    return;
  }

  await recordOrderEvent({
    orderId: data.order_id,
    eventType:
      eventType === "checkout.session.expired"
        ? "checkout_expired"
        : "payment_failed",
    toStatus: "cancelled",
    actorType: "stripe",
    message:
      eventType === "checkout.session.expired"
        ? "Stripe Checkout wygasł. Zamówienie anulowano i przywrócono magazyn."
        : "Płatność Stripe nie powiodła się. Zamówienie anulowano i przywrócono magazyn.",
    metadata: {
      checkoutSessionId: session.id,
    },
  });
}

async function recordStripeRefundExpense(refund: Stripe.Refund) {
  if (refund.amount <= 0) {
    return;
  }

  const orderId = refund.metadata?.order_id ?? null;
  const orderNumberFromMetadata = refund.metadata?.order_number ?? null;
  const returnCaseNumber = refund.metadata?.return_case_number ?? null;
  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id ?? null;

  if (orderNumberFromMetadata) {
    await recordRefundExpense({
      amount: refund.amount / 100,
      orderNumber: orderNumberFromMetadata,
      refundId: refund.id,
      reason: "Zwrot zarejestrowany przez webhook Stripe.",
      returnCaseNumber,
    });
    return;
  }

  const supabase = createSupabaseServiceClient();
  const orderResult = orderId
    ? await supabase
      .from("orders")
      .select("order_number")
      .eq("id", orderId)
      .maybeSingle()
    : paymentIntentId
      ? await supabase
          .from("orders")
          .select("order_number")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle()
      : null;

  if (!orderResult) {
    return;
  }

  const { data: order, error } = orderResult;

  if (error) {
    console.error("Failed to find order for Stripe refund expense", error);
    return;
  }

  if (!order) {
    return;
  }

  await recordRefundExpense({
    amount: refund.amount / 100,
    orderNumber: order.order_number,
    refundId: refund.id,
    reason: "Zwrot zarejestrowany przez webhook Stripe.",
    returnCaseNumber,
  });
}

async function recordOrderEvent({
  actorType,
  eventType,
  message,
  metadata,
  orderId,
  toStatus,
}: {
  actorType: "stripe" | "system";
  eventType:
    | "payment_paid"
    | "payment_failed"
    | "checkout_expired"
    | "email_sent";
  message: string;
  metadata?: Database["public"]["Tables"]["order_events"]["Insert"]["metadata"];
  orderId: string;
  toStatus?: Database["public"]["Tables"]["order_events"]["Insert"]["to_status"];
}) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: eventType,
    to_status: toStatus ?? null,
    actor_type: actorType,
    message,
    metadata: metadata ?? {},
  });

  if (error) {
    console.error("Failed to record order event", error);
  }
}
