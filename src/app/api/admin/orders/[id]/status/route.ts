import { NextResponse, type NextRequest } from "next/server";
import { sendShippedOrderEmail } from "@/lib/email/order-emails";
import {
  canTransitionOrderStatus,
  isOrderStatus,
  orderStatusLabels,
} from "@/lib/order-status";
import { getAdminSession } from "@/lib/supabase/admin";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import {
  getTrackingUrl,
  normalizeShippingCarrier,
  normalizeTrackingNumber,
  normalizeTrackingUrl,
} from "@/lib/tracking";
import type { Database } from "@/types/supabase";

type ShippedOrder =
  Database["public"]["Tables"]["orders"]["Row"] & {
    order_items: Database["public"]["Tables"]["order_items"]["Row"][];
  };

export async function PATCH(
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

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Niepoprawny format danych." },
      { status: 400 },
    );
  }

  const status =
    payload && typeof payload === "object" && "status" in payload
      ? payload.status
      : null;
  const shippingCarrier = getStringPayloadValue(payload, "shippingCarrier");
  const trackingNumber = getStringPayloadValue(payload, "trackingNumber");
  const trackingUrl = getStringPayloadValue(payload, "trackingUrl");
  const normalizedShippingCarrier = shippingCarrier
    ? normalizeShippingCarrier(shippingCarrier)
    : null;
  const normalizedTrackingNumber = trackingNumber
    ? normalizeTrackingNumber(trackingNumber)
    : null;
  const finalTrackingUrl =
    normalizeTrackingUrl(trackingUrl) ??
    getTrackingUrl(normalizedShippingCarrier, normalizedTrackingNumber);

  if (!isOrderStatus(status)) {
    return NextResponse.json(
      { error: "INVALID_STATUS", message: "Niepoprawny status zamówienia." },
      { status: 422 },
    );
  }

  const { id } = await context.params;
  const serverSupabase = await createSupabaseServerClient();
  const { data: currentOrder, error: currentOrderError } = await serverSupabase
    .from("orders")
    .select("id, status, stock_restored_at")
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

  if (
    currentOrder.status === "cancelled" &&
    currentOrder.stock_restored_at &&
    status !== "cancelled"
  ) {
    return NextResponse.json(
      {
        error: "ORDER_STOCK_ALREADY_RESTORED",
        message:
          "To zamówienie przywróciło już magazyn. Nie zmieniaj go z anulowanego na aktywne.",
      },
      { status: 422 },
    );
  }

  if (!canTransitionOrderStatus(currentOrder.status, status)) {
    return NextResponse.json(
      {
        error: "INVALID_STATUS_TRANSITION",
        message: `Nie można zmienić statusu z "${orderStatusLabels[currentOrder.status]}" na "${orderStatusLabels[status]}".`,
      },
      { status: 422 },
    );
  }

  if (status === "shipped") {
    if (currentOrder.status !== "paid" && currentOrder.status !== "shipped") {
      return NextResponse.json(
        {
          error: "ORDER_NOT_PAID",
          message: "Zamówienie musi być opłacone, zanim oznaczysz je jako wysłane.",
        },
        { status: 422 },
      );
    }

    if (!normalizedShippingCarrier || !normalizedTrackingNumber) {
      return NextResponse.json(
        {
          error: "SHIPMENT_DETAILS_REQUIRED",
          message: "Przewoźnik i numer śledzenia są wymagane.",
        },
        { status: 422 },
      );
    }
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } =
    status === "cancelled"
      ? await supabase
          .rpc("cancel_order_and_restore_stock", {
            p_order_id: id,
            p_checkout_session_id: null,
          })
          .single()
      : status === "shipped"
        ? await supabase
            .from("orders")
            .update({
              status,
              shipping_carrier: normalizedShippingCarrier,
              tracking_number: normalizedTrackingNumber,
              tracking_url: finalTrackingUrl,
              shipped_at: new Date().toISOString(),
            })
            .eq("id", id)
            .select("*, order_items(*)")
            .single()
      : await supabase
          .from("orders")
          .update({ status })
          .eq("id", id)
          .select("id, status")
          .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: "ORDER_UPDATE_FAILED",
        message: "Nie udało się zapisać statusu zamówienia.",
      },
      { status: 500 },
    );
  }

  if (status === "shipped") {
    await sendShippedOrderEmailAndMark(data as ShippedOrder);
  }

  await recordAdminOrderEvent({
    orderId: id,
    fromStatus: currentOrder.status,
    toStatus: status,
    actorId: adminSession.userId,
    shippingCarrier: normalizedShippingCarrier,
    trackingNumber: normalizedTrackingNumber,
    trackingUrl: finalTrackingUrl,
  });

  return NextResponse.json({ order: data });
}

async function sendShippedOrderEmailAndMark(order: ShippedOrder) {
  try {
    const emailSent = await sendShippedOrderEmail(order);

    if (!emailSent) {
      return;
    }

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("orders")
      .update({ shipping_email_sent_at: new Date().toISOString() })
      .eq("id", order.id);

    if (error) {
      console.error("Failed to store shipping email timestamp", error);
      return;
    }

    const { error: eventError } = await supabase.from("order_events").insert({
      order_id: order.id,
      event_type: "email_sent",
      actor_type: "system",
      message: "Wysłano e-mail z informacją o wysyłce.",
      metadata: {
        shippingCarrier: order.shipping_carrier,
        trackingNumber: order.tracking_number,
        trackingUrl: order.tracking_url,
      },
    });

    if (eventError) {
      console.error("Failed to record shipping email event", eventError);
    }
  } catch (error) {
    console.error("Failed to send shipping email", error);
  }
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

async function recordAdminOrderEvent({
  actorId,
  fromStatus,
  orderId,
  shippingCarrier,
  toStatus,
  trackingNumber,
  trackingUrl,
}: {
  actorId: string | null;
  fromStatus: ShippedOrder["status"];
  orderId: string;
  shippingCarrier: string | null;
  toStatus: ShippedOrder["status"];
  trackingNumber: string | null;
  trackingUrl: string | null;
}) {
  const isTrackingUpdate = fromStatus === "shipped" && toStatus === "shipped";
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: isTrackingUpdate ? "tracking_updated" : "status_changed",
    from_status: fromStatus,
    to_status: toStatus,
    actor_type: "admin",
    actor_id: actorId,
    message: isTrackingUpdate
      ? "Zaktualizowano dane śledzenia przesyłki."
      : `Zmieniono status z "${orderStatusLabels[fromStatus]}" na "${orderStatusLabels[toStatus]}".`,
    metadata: {
      shippingCarrier,
      trackingNumber,
      trackingUrl,
    },
  });

  if (error) {
    console.error("Failed to record admin order event", error);
  }
}
