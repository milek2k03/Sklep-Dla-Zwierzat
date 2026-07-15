import { notifyAdminError } from "@/lib/monitoring/admin-alerts";
import { hasStripeCheckoutEnv } from "@/lib/stripe/env";
import { getStripeClient } from "@/lib/stripe/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

const unpaidOrderTimeoutMinutes = 15;
const unpaidOrderBatchSize = 25;

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ExpirableOrder = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "payment_method"
  | "status"
  | "stock_restored_at"
  | "stripe_checkout_session_id"
>;

export async function expireUnpaidOrders() {
  if (!hasSupabaseServiceEnv()) {
    return { expired: 0 };
  }

  const supabase = createSupabaseServiceClient();
  const cutoff = new Date(
    Date.now() - unpaidOrderTimeoutMinutes * 60 * 1000,
  ).toISOString();
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, payment_method, status, stock_restored_at, stripe_checkout_session_id",
    )
    .in("status", ["new", "confirmed"])
    .eq("payment_method", "stripe")
    .is("stock_restored_at", null)
    .lte("created_at", cutoff)
    .limit(unpaidOrderBatchSize);

  if (error) {
    console.error("Failed to fetch unpaid orders for expiration", error);
    await notifyAdminError({
      title: "Nie udało się pobrać nieopłaconych zamówień do anulowania",
      source: "orders.expireUnpaidOrders.fetchOrders",
      error,
      context: {
        cutoff,
        batchSize: unpaidOrderBatchSize,
      },
    });
    return { expired: 0 };
  }

  let expired = 0;

  for (const order of (orders ?? []) as ExpirableOrder[]) {
    const stripeSessionExpired = await expireStripeCheckoutSession(order);

    if (!stripeSessionExpired) {
      continue;
    }

    const cancelled = await cancelOrderAndRestoreStock(order);

    if (cancelled) {
      expired += 1;
    }
  }

  return { expired };
}

async function expireStripeCheckoutSession(order: ExpirableOrder) {
  if (!order.stripe_checkout_session_id || !hasStripeCheckoutEnv()) {
    return true;
  }

  const stripe = getStripeClient();
  let session: Awaited<
    ReturnType<typeof stripe.checkout.sessions.retrieve>
  >;

  try {
    session = await stripe.checkout.sessions.retrieve(
      order.stripe_checkout_session_id,
    );
  } catch (error) {
    if (isMissingStripeSessionError(error)) {
      return true;
    }

    console.error(
      `Failed to expire Stripe Checkout session for order ${order.order_number}`,
      error,
    );
    await notifyAdminError({
      title: "Nie udało się pobrać sesji Stripe Checkout przed anulowaniem",
      source: "orders.expireUnpaidOrders.retrieveStripeSession",
      error,
      context: getOrderAlertContext(order),
    });
    return false;
  }

  if (session.payment_status === "paid" || session.status === "complete") {
    return false;
  }

  if (session.status !== "open") {
    return true;
  }

  try {
    await stripe.checkout.sessions.expire(order.stripe_checkout_session_id);
    return true;
  } catch (error) {
    console.error(
      `Failed to expire open Stripe Checkout session for order ${order.order_number}`,
      error,
    );
    await notifyAdminError({
      title: "Nie udało się wygasić otwartej sesji Stripe Checkout",
      source: "orders.expireUnpaidOrders.expireStripeSession",
      error,
      context: getOrderAlertContext(order),
    });
    return false;
  }
}

async function cancelOrderAndRestoreStock(order: ExpirableOrder) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc("cancel_order_and_restore_stock", {
      p_order_id: order.id,
      p_checkout_session_id: order.stripe_checkout_session_id,
    })
    .single();

  if (error || !data) {
    console.error(
      `Failed to cancel unpaid order ${order.order_number}`,
      error,
    );
    await notifyAdminError({
      title: "Nie udało się anulować nieopłaconego zamówienia",
      source: "orders.expireUnpaidOrders.cancelOrder",
      error,
      context: getOrderAlertContext(order),
    });
    return false;
  }

  const { error: eventError } = await supabase.from("order_events").insert({
    order_id: data.order_id,
    event_type: "checkout_expired",
    from_status: order.status,
    to_status: "cancelled",
    actor_type: "system",
    message:
      "Zamówienie nie zostało opłacone w ciągu 15 minut. Anulowano je i przywrócono stan magazynowy.",
    metadata: {
      checkoutSessionId: order.stripe_checkout_session_id,
      reason: "unpaid_timeout",
      timeoutMinutes: unpaidOrderTimeoutMinutes,
    },
  });

  if (eventError) {
    console.error(
      `Failed to record unpaid order expiration event for ${order.order_number}`,
      eventError,
    );
    await notifyAdminError({
      title: "Nie udało się zapisać zdarzenia anulowania nieopłaconego zamówienia",
      source: "orders.expireUnpaidOrders.recordEvent",
      error: eventError,
      context: getOrderAlertContext(order),
    });
  }

  return true;
}

function getOrderAlertContext(order: ExpirableOrder) {
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    paymentMethod: order.payment_method,
    status: order.status,
    stripeCheckoutSessionId: order.stripe_checkout_session_id,
  };
}

function isMissingStripeSessionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stripeError = error as { code?: string };

  return stripeError.code === "resource_missing";
}
