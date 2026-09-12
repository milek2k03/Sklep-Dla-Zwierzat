import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import {
  asJsonObject,
  buildSystemConversionIdentity,
  recordConversionEvent,
} from "@/lib/conversion";
import { sendPaidOrderEmails } from "@/lib/email/order-emails";
import { notifyAdminError } from "@/lib/monitoring/admin-alerts";
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
  const stripePaymentMethodType = await getStripePaymentMethodType({
    paymentIntentId,
    session,
  });

  const supabase = createSupabaseServiceClient();
  const update = {
    status: "paid" as const,
    payment_method: "stripe" as const,
    stripe_checkout_session_id: session.id,
    stripe_payment_method_type: stripePaymentMethodType,
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
    await notifyAdminError({
      title: "Nie udało się oznaczyć zamówienia Stripe jako opłacone",
      source: "stripe.webhook.markOrderAsPaid",
      error,
      context: {
        checkoutSessionId: session.id,
        orderId,
        paymentIntentId,
      },
    });
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

  const conversionIdentity =
    session.metadata?.conversion_visitor_id &&
    session.metadata?.conversion_session_id
      ? {
          visitor_id: session.metadata.conversion_visitor_id,
          session_id: session.metadata.conversion_session_id,
        }
      : buildSystemConversionIdentity(updatedOrder.order_number);

  await recordConversionEvent({
    event_type: "order_paid",
    ...conversionIdentity,
    order_id: updatedOrder.id,
    order_number: updatedOrder.order_number,
    amount: Number(updatedOrder.total ?? 0),
    quantity: updatedOrder.order_items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    ),
    metadata: asJsonObject({
      checkoutSessionId: session.id,
      stripePaymentMethodType,
      paymentIntentId,
    }),
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
      await notifyAdminError({
        title: "Nie udało się zapisać daty wysłania e-maili zamówienia",
        source: "stripe.webhook.sendPaidOrderEmailsAndMark",
        error,
        context: {
          orderId: order.id,
          orderNumber: order.order_number,
          update,
        },
      });
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
    await notifyAdminError({
      title: "Nie udało się wysłać e-maili po opłaceniu zamówienia",
      source: "stripe.webhook.sendPaidOrderEmailsAndMark",
      error,
      context: {
        orderId: order.id,
        orderNumber: order.order_number,
      },
    });
  }
}

async function getStripePaymentMethodType({
  paymentIntentId,
  session,
}: {
  paymentIntentId: string | null;
  session: Stripe.Checkout.Session;
}) {
  if (!paymentIntentId) {
    return session.payment_method_types?.[0] ?? null;
  }

  try {
    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["payment_method"],
      },
    );
    const paymentMethod = paymentIntent.payment_method;

    if (
      paymentMethod &&
      typeof paymentMethod === "object" &&
      "type" in paymentMethod &&
      typeof paymentMethod.type === "string"
    ) {
      return paymentMethod.type;
    }
  } catch (error) {
    console.error("Failed to fetch Stripe payment method type", error);
    await notifyAdminError({
      title: "Nie udało się pobrać typu płatności Stripe",
      source: "stripe.webhook.getPaymentMethodType",
      error,
      context: {
        checkoutSessionId: session.id,
        paymentIntentId,
      },
    });
  }

  return session.payment_method_types?.[0] ?? null;
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
    await notifyAdminError({
      title: "Nie udało się anulować zamówienia po zdarzeniu Stripe",
      source: "stripe.webhook.cancelOrderAndRestoreStock",
      error,
      context: {
        checkoutSessionId: session.id,
        orderId: session.metadata?.order_id ?? null,
        eventType,
      },
    });
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
    await notifyAdminError({
      title: "Nie udało się zapisać zdarzenia zamówienia",
      source: "stripe.webhook.recordOrderEvent",
      error,
      context: {
        orderId,
        eventType,
        toStatus,
      },
    });
  }
}
