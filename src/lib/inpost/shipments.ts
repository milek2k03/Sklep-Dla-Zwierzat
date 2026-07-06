import {
  InpostApiError,
  inpostShipXFileRequest,
  inpostShipXRequest,
} from "@/lib/inpost/client";
import {
  getInpostShipXEnv,
  hasInpostCourierParcelEnv,
} from "@/lib/inpost/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getTrackingUrl } from "@/lib/tracking";
import type { Database } from "@/types/supabase";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type InpostShipment = {
  id: string | number;
  status: string;
  tracking_number: string | null;
  service: string;
  reference: string | null;
  parcels?: Array<{
    tracking_number?: string | null;
  }>;
};

type InpostShipmentCollection = {
  items?: InpostShipment[];
};

export async function ensureInpostShipmentForOrder(orderId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new InpostApiError("Nie znaleziono zamówienia.", 404, error);
  }

  assertOrderCanHaveInpostShipment(order);

  if (order.inpost_shipment_id) {
    return refreshInpostShipmentForOrder(order);
  }

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_inpost_shipment_creation",
    {
      p_order_id: order.id,
    },
  );

  if (claimError) {
    throw new InpostApiError(
      "Nie udało się zablokować tworzenia przesyłki InPost.",
      500,
      claimError,
    );
  }

  if (!claimed) {
    const { data: currentOrder } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order.id)
      .single();

    if (currentOrder?.inpost_shipment_id) {
      return refreshInpostShipmentForOrder(currentOrder);
    }

    throw new InpostApiError(
      "Tworzenie przesyłki InPost już trwa. Odśwież zamówienie za chwilę.",
      409,
    );
  }

  try {
    const existingShipment = await findExistingShipment(order);
    const shipment =
      existingShipment ?? (await createInpostShipmentForOrder(order));

    await saveShipmentOnOrder(order, shipment);
    await recordShipmentEvent(
      order.id,
      "shipment_created",
      existingShipment
        ? "Połączono zamówienie z istniejącą przesyłką InPost."
        : "Utworzono przesyłkę InPost.",
      shipment,
    );

    return shipment;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nieznany błąd InPost.";

    await supabase
      .from("orders")
      .update({
        inpost_shipment_status: "error",
        inpost_shipment_error: message.slice(0, 1000),
      })
      .eq("id", order.id);

    await recordShipmentEvent(
      order.id,
      "shipment_error",
      "Nie udało się utworzyć przesyłki InPost.",
      { error: message },
    );

    throw error;
  }
}

export async function refreshInpostShipmentByOrderId(orderId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new InpostApiError("Nie znaleziono zamówienia.", 404, error);
  }

  if (!order.inpost_shipment_id) {
    return ensureInpostShipmentForOrder(order.id);
  }

  return refreshInpostShipmentForOrder(order);
}

export async function downloadInpostLabelForOrder(orderId: string) {
  const shipment = await refreshInpostShipmentByOrderId(orderId);

  if (!isInpostLabelAvailable(shipment.status)) {
    throw new InpostApiError(
      `Etykieta nie jest jeszcze gotowa. Aktualny status InPost: ${shipment.status}.`,
      409,
    );
  }

  return inpostShipXFileRequest(
    `/v1/shipments/${encodeURIComponent(String(shipment.id))}/label?format=Pdf&type=A6`,
  );
}

export function isInpostLabelAvailable(status: string | null | undefined) {
  return Boolean(
    status &&
      ![
        "creating",
        "created",
        "offers_prepared",
        "offer_selected",
        "error",
        "canceled",
      ].includes(status),
  );
}

async function createInpostShipmentForOrder(order: OrderRow) {
  const env = getInpostShipXEnv();
  const isLocker = order.delivery_method === "inpost-paczkomat";

  if (!isLocker && !hasInpostCourierParcelEnv()) {
    throw new InpostApiError(
      "Dla kuriera ustaw INPOST_COURIER_LENGTH_MM, INPOST_COURIER_WIDTH_MM, INPOST_COURIER_HEIGHT_MM i INPOST_COURIER_WEIGHT_KG.",
      503,
    );
  }

  if (isLocker && !order.pickup_point) {
    throw new InpostApiError(
      "Zamówienie nie ma wybranego punktu InPost.",
      422,
    );
  }

  const receiverName = splitCustomerName(order.customer_full_name);
  const receiver = {
    first_name: receiverName.firstName,
    last_name: receiverName.lastName,
    email: order.customer_email,
    phone: normalizeInpostPhone(order.customer_phone),
    ...(isLocker
      ? {}
      : {
          address: {
            street: order.delivery_street,
            building_number: order.delivery_building_number,
            city: order.delivery_city,
            post_code: order.delivery_postal_code,
            country_code: "PL",
          },
        }),
  };
  const parcels = isLocker
    ? { template: env.lockerTemplate }
    : {
        dimensions: {
          length: env.courierParcel.length,
          width: env.courierParcel.width,
          height: env.courierParcel.height,
          unit: "mm",
        },
        weight: {
          amount: env.courierParcel.weight,
          unit: "kg",
        },
        is_non_standard: false,
      };
  const payload = {
    receiver,
    parcels,
    service: isLocker
      ? "inpost_locker_standard"
      : "inpost_courier_standard",
    reference: order.order_number,
    ...(isLocker
      ? {
          custom_attributes: {
            target_point: order.pickup_point,
            sending_method: "dispatch_order",
          },
        }
      : {}),
  };

  return inpostShipXRequest<InpostShipment>(
    `/v1/organizations/${encodeURIComponent(env.organizationId ?? "")}/shipments`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

async function findExistingShipment(order: OrderRow) {
  const env = getInpostShipXEnv();
  const createdAt = new Date(order.created_at);
  createdAt.setDate(createdAt.getDate() - 1);
  const params = new URLSearchParams({
    created_at_gteq: createdAt.toISOString(),
    per_page: "100",
    sort_by: "created_at",
    sort_order: "desc",
  });
  const collection = await inpostShipXRequest<InpostShipmentCollection>(
    `/v1/organizations/${encodeURIComponent(env.organizationId ?? "")}/shipments?${params}`,
  );

  return collection.items?.find(
    (shipment) => shipment.reference === order.order_number,
  );
}

async function refreshInpostShipmentForOrder(order: OrderRow) {
  const shipment = await inpostShipXRequest<InpostShipment>(
    `/v1/shipments/${encodeURIComponent(order.inpost_shipment_id ?? "")}`,
  );

  await saveShipmentOnOrder(order, shipment);

  return shipment;
}

async function saveShipmentOnOrder(
  order: OrderRow,
  shipment: InpostShipment,
) {
  const supabase = createSupabaseServiceClient();
  const trackingNumber = getShipmentTrackingNumber(shipment);
  const update: Database["public"]["Tables"]["orders"]["Update"] = {
    inpost_shipment_id: String(shipment.id),
    inpost_shipment_status: shipment.status,
    inpost_service: shipment.service,
    inpost_shipment_error: null,
    inpost_shipment_created_at:
      order.inpost_shipment_created_at ?? new Date().toISOString(),
    shipping_carrier: "InPost",
  };

  if (trackingNumber) {
    update.tracking_number = trackingNumber;
    update.tracking_url = getTrackingUrl("InPost", trackingNumber);
  }

  const { error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", order.id);

  if (error) {
    throw new InpostApiError(
      "Utworzono przesyłkę InPost, ale nie udało się zapisać jej w zamówieniu.",
      500,
      error,
    );
  }
}

function assertOrderCanHaveInpostShipment(order: OrderRow) {
  if (
    order.delivery_method !== "inpost-paczkomat" &&
    order.delivery_method !== "inpost-kurier"
  ) {
    throw new InpostApiError(
      "To zamówienie nie korzysta z dostawy InPost.",
      422,
    );
  }

  if (order.status !== "paid" && order.status !== "shipped") {
    throw new InpostApiError(
      "Przesyłkę InPost można utworzyć dopiero po opłaceniu zamówienia.",
      422,
    );
  }
}

function splitCustomerName(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/);

  return {
    firstName: nameParts.shift() ?? fullName,
    lastName: nameParts.join(" ") || "-",
  };
}

function normalizeInpostPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  return digits.length === 11 && digits.startsWith("48")
    ? digits.slice(2)
    : digits;
}

function getShipmentTrackingNumber(shipment: InpostShipment) {
  return (
    shipment.tracking_number ??
    shipment.parcels?.find((parcel) => parcel.tracking_number)?.tracking_number ??
    null
  );
}

async function recordShipmentEvent(
  orderId: string,
  eventType: "shipment_created" | "shipment_error",
  message: string,
  metadata: unknown,
) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: eventType,
    actor_type: "system",
    message,
    metadata: metadata as Database["public"]["Tables"]["order_events"]["Insert"]["metadata"],
  });

  if (error) {
    console.error("Failed to record InPost shipment event", error);
  }
}
