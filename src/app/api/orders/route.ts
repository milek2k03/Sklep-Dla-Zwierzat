import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildVerifiedOrder,
  createOrderNumber,
  orderRequestSchema,
  UnknownOrderProductsError,
} from "@/lib/order-server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`orders:${ip}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "TOO_MANY_REQUESTS",
        message: "Zbyt wiele prób. Spróbuj ponownie za chwilę.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter ?? 60),
        },
      },
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

  const parsedPayload = orderRequestSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "Sprawdź dane zamówienia.",
        details: parsedPayload.error.flatten(),
      },
      { status: 422 },
    );
  }

  const orderNumber = createOrderNumber();
  let order: ReturnType<typeof buildVerifiedOrder>;

  try {
    order = buildVerifiedOrder(parsedPayload.data, orderNumber);
  } catch (error) {
    if (error instanceof UnknownOrderProductsError) {
      return NextResponse.json(
        {
          error: "UNKNOWN_PRODUCTS",
          message: "Koszyk zawiera produkt spoza katalogu.",
          details: { slugs: error.slugs },
        },
        { status: 422 },
      );
    }

    console.error("Failed to verify order", error);

    return NextResponse.json(
      {
        error: "ORDER_VERIFICATION_FAILED",
        message: "Nie udalo sie zweryfikowac zamowienia.",
      },
      { status: 422 },
    );
  }

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        error: "SUPABASE_NOT_CONFIGURED",
        message: "Backend Supabase nie jest jeszcze skonfigurowany.",
      },
      { status: 503 },
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: insertedOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: order.id,
      customer_full_name: order.customer.fullName,
      customer_email: order.customer.email,
      customer_phone: order.customer.phone,
      delivery_method: order.deliveryMethod,
      delivery_address: order.customer.address,
      pickup_point: order.customer.pickupPoint ?? null,
      notes: order.customer.notes ?? null,
      subtotal: order.subtotal,
      delivery_cost: order.deliveryCost,
      total: order.total,
      payment_method: "manual",
      status: "new",
    })
    .select("id, order_number, created_at")
    .single();

  if (orderError || !insertedOrder) {
    console.error("Failed to insert order", orderError);

    return NextResponse.json(
      {
        error: "ORDER_INSERT_FAILED",
        message: "Nie udało się zapisać zamówienia.",
      },
      { status: 500 },
    );
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    order.items.map((item) => ({
      order_id: insertedOrder.id,
      product_slug: item.product.slug,
      product_name: item.product.name,
      unit_price: item.product.price,
      quantity: item.quantity,
      line_total: Math.round(item.product.price * item.quantity * 100) / 100,
    })),
  );

  if (itemsError) {
    console.error("Failed to insert order items", itemsError);
    await supabase.from("orders").delete().eq("id", insertedOrder.id);

    return NextResponse.json(
      {
        error: "ORDER_ITEMS_INSERT_FAILED",
        message: "Zamówienie zapisano bez pozycji. Skontaktuj się ze sklepem.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    order: {
      ...order,
      id: insertedOrder.order_number,
      createdAt: insertedOrder.created_at,
    },
  });
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}
