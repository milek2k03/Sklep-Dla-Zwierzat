import { notifyAdminError } from "@/lib/monitoring/admin-alerts";
import { hasStripeCheckoutEnv } from "@/lib/stripe/env";
import { getStripeClient } from "@/lib/stripe/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

const unpaidOrderTimeoutMinutes = 15;
const unpaidOrderBatchSize = 10;
const unpaidOrderFetchAttempts = 3;
const unpaidOrderFetchRetryDelayMs = 350;
const silentRunCooldownMs = 60 * 1000;

let lastSilentRunAt = 0;

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

type ExpireUnpaidOrdersOptions = {
  notifyOnError?: boolean;
};

export async function expireUnpaidOrders(
  options: ExpireUnpaidOrdersOptions = {},
) {
  if (!hasSupabaseServiceEnv()) {
    return { expired: 0 };
  }

  const notifyOnError = options.notifyOnError ?? false;
  const now = Date.now();

  if (!notifyOnError && now - lastSilentRunAt < silentRunCooldownMs) {
    return { expired: 0, skipped: true };
  }

  if (!notifyOnError) {
    lastSilentRunAt = now;
  }

  const supabase = createSupabaseServiceClient();
  const cutoff = new Date(
    Date.now() - unpaidOrderTimeoutMinutes * 60 * 1000,
  ).toISOString();
  const { error, orders } = await fetchExpirableOrders(supabase, cutoff);

  if (error) {
    console.error("Failed to fetch unpaid orders for expiration", error);

    if (notifyOnError) {
      await notifyAdminError({
        title: "Nie udało się pobrać nieopłaconych zamówień do anulowania",
        source: "orders.expireUnpaidOrders.fetchOrders",
        error,
        context: {
          attempts: unpaidOrderFetchAttempts,
          batchSize: unpaidOrderBatchSize,
          cutoff,
        },
      });
    }

    return { expired: 0, failed: true };
  }

  let expired = 0;

  for (const order of orders) {
    const stripeSessionExpired = await expireStripeCheckoutSession(
      order,
      notifyOnError,
    );

    if (!stripeSessionExpired) {
      continue;
    }

    const cancelled = await cancelOrderAndRestoreStock(order, notifyOnError);

    if (cancelled) {
      expired += 1;
    }
  }

  return { expired };
}

async function fetchExpirableOrders(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  cutoff: string,
) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= unpaidOrderFetchAttempts; attempt += 1) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, payment_method, status, stock_restored_at, stripe_checkout_session_id",
      )
      .in("status", ["new", "confirmed"])
      .eq("payment_method", "stripe")
      .is("stock_restored_at", null)
      .lte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(unpaidOrderBatchSize);

    if (!error) {
      return {
        error: null,
        orders: (data ?? []) as ExpirableOrder[],
      };
    }

    lastError = error;

    if (!isTransientFetchError(error) || attempt === unpaidOrderFetchAttempts) {
      break;
    }

    await wait(unpaidOrderFetchRetryDelayMs * attempt);
  }

  return {
    error: lastError,
    orders: [],
  };
}

async function expireStripeCheckoutSession(
  order: ExpirableOrder,
  notifyOnError: boolean,
) {
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

    if (notifyOnError) {
      await notifyAdminError({
        title: "Nie udało się pobrać sesji Stripe Checkout przed anulowaniem",
        source: "orders.expireUnpaidOrders.retrieveStripeSession",
        error,
        context: getOrderAlertContext(order),
      });
    }

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

    if (notifyOnError) {
      await notifyAdminError({
        title: "Nie udało się wygasić otwartej sesji Stripe Checkout",
        source: "orders.expireUnpaidOrders.expireStripeSession",
        error,
        context: getOrderAlertContext(order),
      });
    }

    return false;
  }
}

async function cancelOrderAndRestoreStock(
  order: ExpirableOrder,
  notifyOnError: boolean,
) {
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

    if (notifyOnError) {
      await notifyAdminError({
        title: "Nie udało się anulować nieopłaconego zamówienia",
        source: "orders.expireUnpaidOrders.cancelOrder",
        error,
        context: getOrderAlertContext(order),
      });
    }

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

    if (notifyOnError) {
      await notifyAdminError({
        title:
          "Nie udało się zapisać zdarzenia anulowania nieopłaconego zamówienia",
        source: "orders.expireUnpaidOrders.recordEvent",
        error: eventError,
        context: getOrderAlertContext(order),
      });
    }
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

function isTransientFetchError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("gateway timeout") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("network")
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    return typeof message === "string" ? message : "";
  }

  return typeof error === "string" ? error : "";
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
