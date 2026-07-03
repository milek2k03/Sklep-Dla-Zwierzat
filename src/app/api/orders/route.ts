import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildVerifiedOrder,
  createOrderNumber,
  InsufficientOrderStockError,
  orderRequestSchema,
  UnknownOrderProductsError,
} from "@/lib/order-server";
import { normalizeDiscountCode } from "@/lib/discounts";
import { getPublishedProducts } from "@/lib/products";
import { getStripeEnv, hasStripeCheckoutEnv } from "@/lib/stripe/env";
import { getStripeClient } from "@/lib/stripe/server";
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

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        error: "SUPABASE_NOT_CONFIGURED",
        message: "Backend Supabase nie jest jeszcze skonfigurowany.",
      },
      { status: 503 },
    );
  }

  if (!hasStripeCheckoutEnv()) {
    return NextResponse.json(
      {
        error: "STRIPE_NOT_CONFIGURED",
        message: "Stripe nie jest jeszcze skonfigurowany.",
      },
      { status: 503 },
    );
  }

  const supabase = createSupabaseServiceClient();

  try {
    const productCatalog = await getPublishedProducts({
      fallback: false,
      includePurchasePrice: true,
    });
    const discountCode = normalizeDiscountCode(parsedPayload.data.discountCode);
    const { data: discount, error: discountError } = discountCode
      ? await supabase
          .from("discount_codes")
          .select("*")
          .eq("code", discountCode)
          .maybeSingle()
      : { data: null, error: null };

    if (discountError) {
      console.error("Failed to fetch discount code", discountError);
    }

    order = buildVerifiedOrder(
      parsedPayload.data,
      orderNumber,
      productCatalog,
      discount,
    );

    if (discountCode && !order.discountCode) {
      return NextResponse.json(
        {
          error: "INVALID_DISCOUNT",
          message: "Kod rabatowy jest nieaktywny albo nie pasuje do koszyka.",
        },
        { status: 422 },
      );
    }
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

    if (error instanceof InsufficientOrderStockError) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_STOCK",
          message: "Koszyk przekracza dostępny stan magazynowy.",
          details: { items: error.items },
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

  const { data: insertedOrder, error: orderError } = await supabase
    .rpc("create_order_with_stock", {
      p_order: {
        order_number: order.id,
        customer_full_name: order.customer.fullName,
        customer_email: order.customer.email,
        customer_phone: order.customer.phone,
        delivery_method: order.deliveryMethod,
        delivery_address: order.customer.address,
        delivery_city: order.customer.city ?? null,
        delivery_street: order.customer.street ?? null,
        delivery_building_number: order.customer.buildingNumber ?? null,
        delivery_postal_code: order.customer.postalCode ?? null,
        delivery_country: order.customer.country,
        pickup_point: order.customer.pickupPoint ?? null,
        notes: order.customer.notes ?? null,
        subtotal: order.subtotal,
        discount_code: order.discountCode || null,
        discount_total: order.discountTotal ?? 0,
        delivery_cost: order.deliveryCost,
        total: order.total,
        payment_method: "stripe",
        status: "new",
      },
      p_items: order.items.map((item) => {
        const unitPurchasePrice = item.product.purchasePrice ?? 0;

        return {
          product_slug: item.product.slug,
          product_name: item.product.name,
          unit_price: item.product.price,
          unit_purchase_price: unitPurchasePrice,
          quantity: item.quantity,
          line_total: Math.round(item.product.price * item.quantity * 100) / 100,
          purchase_total: Math.round(unitPurchasePrice * item.quantity * 100) / 100,
        };
      }),
    })
    .single();

  if (orderError || !insertedOrder) {
    if (orderError?.message === "ORDER_INSUFFICIENT_STOCK") {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_STOCK",
          message: "Koszyk przekracza dostępny stan magazynowy.",
          details: parseStockErrorDetails(orderError.details),
        },
        { status: 422 },
      );
    }

    console.error("Failed to create order with stock update", orderError);

    return NextResponse.json(
      {
        error: "ORDER_INSERT_FAILED",
        message: "Nie udało się zapisać zamówienia.",
      },
      { status: 500 },
    );
  }

  const stripe = getStripeClient();
  const appUrl = getStripeEnv().appUrl.replace(/\/$/, "");
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: insertedOrder.order_number,
    customer_email: order.customer.email,
    metadata: {
      order_id: insertedOrder.order_id,
      order_number: insertedOrder.order_number,
    },
    line_items: [
      ...order.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "pln",
          unit_amount: toStripeAmount(item.product.price),
          product_data: {
            name: item.product.name,
            metadata: {
              product_slug: item.product.slug,
              product_id: item.product.id,
            },
          },
        },
      })),
      ...(order.deliveryCost > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "pln",
                unit_amount: toStripeAmount(order.deliveryCost),
                product_data: {
                  name: "Dostawa",
                },
              },
            },
          ]
        : []),
    ],
    discounts:
      order.discountTotal && order.discountTotal > 0
        ? [
            {
              coupon: await createCheckoutDiscountCoupon(
                order.discountCode ?? "RABAT",
                order.discountTotal,
              ),
            },
          ]
        : undefined,
    success_url: `${appUrl}/zamowienie/sukces?order=${encodeURIComponent(insertedOrder.order_number)}`,
    cancel_url: `${appUrl}/koszyk?payment=cancelled&order=${encodeURIComponent(insertedOrder.order_number)}`,
  });

  if (!checkoutSession.url) {
    console.error("Stripe checkout session has no URL", checkoutSession.id);

    return NextResponse.json(
      {
        error: "STRIPE_CHECKOUT_FAILED",
        message: "Nie udało się uruchomić płatności Stripe.",
      },
      { status: 500 },
    );
  }

  const { error: stripeUpdateError } = await supabase
    .from("orders")
    .update({
      stripe_checkout_session_id: checkoutSession.id,
    })
    .eq("id", insertedOrder.order_id);

  if (stripeUpdateError) {
    console.error("Failed to store Stripe session ID", stripeUpdateError);
  }

  const publicOrder = {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      product: withoutPurchasePrice(item.product),
    })),
  };

  return NextResponse.json({
    order: {
      ...publicOrder,
      id: insertedOrder.order_number,
      createdAt: insertedOrder.created_at,
    },
    checkoutUrl: checkoutSession.url,
  });
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

function parseStockErrorDetails(details: string | null | undefined) {
  if (!details) {
    return undefined;
  }

  try {
    return JSON.parse(details) as unknown;
  } catch {
    return details;
  }
}

function toStripeAmount(value: number) {
  return Math.round(value * 100);
}

function withoutPurchasePrice<T extends { purchasePrice?: number }>(product: T) {
  const publicProduct = { ...product };

  delete publicProduct.purchasePrice;

  return publicProduct;
}

async function createCheckoutDiscountCoupon(name: string, discountTotal: number) {
  const stripe = getStripeClient();
  const coupon = await stripe.coupons.create({
    name,
    amount_off: toStripeAmount(discountTotal),
    currency: "pln",
    duration: "once",
  });

  return coupon.id;
}
