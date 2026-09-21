import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  asJsonObject,
  buildSystemConversionIdentity,
  recordConversionEvent,
} from "@/lib/conversion";
import { notifyAdminError } from "@/lib/monitoring/admin-alerts";
import {
  buildVerifiedOrder,
  createOrderNumber,
  InsufficientOrderStockError,
  orderRequestSchema,
  UnknownOrderProductsError,
} from "@/lib/order-server";
import { expireUnpaidOrders } from "@/lib/orders/expire-unpaid";
import { normalizeDiscountCode } from "@/lib/discounts";
import { getPublishedProducts } from "@/lib/products";
import { getStripeEnv, hasStripeCheckoutEnv } from "@/lib/stripe/env";
import { getStripeClient } from "@/lib/stripe/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  getClientIp,
  rejectCrossOriginRequest,
  rejectLargeRequest,
} from "@/lib/security";

export async function POST(request: NextRequest) {
  const invalidOrigin = rejectCrossOriginRequest(request);

  if (invalidOrigin) {
    return invalidOrigin;
  }

  const tooLarge = rejectLargeRequest(request);

  if (tooLarge) {
    return tooLarge;
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`orders:${ip}`, {
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
  await expireUnpaidOrders();

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
  const conversionIdentity = parsedPayload.data.conversion
    ? {
        visitor_id: parsedPayload.data.conversion.visitorId,
        session_id: parsedPayload.data.conversion.sessionId,
      }
    : buildSystemConversionIdentity(insertedOrder.order_number);
  let checkoutSession: Awaited<
    ReturnType<typeof stripe.checkout.sessions.create>
  >;

  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: insertedOrder.order_number,
      customer_email: order.customer.email,
      metadata: {
        order_id: insertedOrder.order_id,
        order_number: insertedOrder.order_number,
        ...(parsedPayload.data.conversion
          ? {
              conversion_visitor_id: parsedPayload.data.conversion.visitorId,
              conversion_session_id: parsedPayload.data.conversion.sessionId,
            }
          : {}),
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
  } catch (error) {
    await cleanupCheckoutFailure({
      error,
      orderId: insertedOrder.order_id,
      orderNumber: insertedOrder.order_number,
      source: "orders.createCheckoutSession",
      supabase,
    });

    return NextResponse.json(
      {
        error: "STRIPE_CHECKOUT_FAILED",
        message: "Nie udało się uruchomić płatności Stripe.",
      },
      { status: 500 },
    );
  }

  if (!checkoutSession.url) {
    console.error("Stripe checkout session has no URL", checkoutSession.id);
    await cleanupCheckoutFailure({
      checkoutSessionId: checkoutSession.id,
      error: new Error("Stripe checkout session has no URL"),
      orderId: insertedOrder.order_id,
      orderNumber: insertedOrder.order_number,
      source: "orders.checkoutSessionMissingUrl",
      supabase,
    });

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
    await cleanupCheckoutFailure({
      checkoutSessionId: checkoutSession.id,
      error: stripeUpdateError,
      orderId: insertedOrder.order_id,
      orderNumber: insertedOrder.order_number,
      source: "orders.storeStripeSessionId",
      supabase,
    });

    return NextResponse.json(
      {
        error: "CHECKOUT_SESSION_STORE_FAILED",
        message:
          "Nie udało się bezpiecznie zapisać płatności. Spróbuj ponownie za chwilę.",
      },
      { status: 500 },
    );
  }

  if (parsedPayload.data.marketingConsent) {
    const { error: consentError } = await supabase
      .from("marketing_consents")
      .insert({
        order_id: insertedOrder.order_id,
        email: order.customer.email.trim().toLowerCase(),
        consent_version: "checkout-email-products-v1",
        consent_text:
          "Chcę otrzymywać od Pawly na podany adres e-mail wiadomości o produktach i promocjach. Zgoda jest opcjonalna, można ją wycofać w każdej chwili, pisząc na adres kontaktowy sklepu. Zakup nie wymaga tej zgody.",
      });

    if (consentError) {
      await cleanupCheckoutFailure({
        checkoutSessionId: checkoutSession.id,
        error: consentError,
        orderId: insertedOrder.order_id,
        orderNumber: insertedOrder.order_number,
        source: "orders.storeMarketingConsent",
        supabase,
      });
      return NextResponse.json(
        {
          error: "CONSENT_STORE_FAILED",
          message: "Nie udało się zapisać zgody. Spróbuj ponownie za chwilę.",
        },
        { status: 500 },
      );
    }
  }

  await recordConversionEvent({
    event_type: "order_created",
    ...conversionIdentity,
    order_id: insertedOrder.order_id,
    order_number: insertedOrder.order_number,
    amount: order.total,
    quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    metadata: asJsonObject({
      checkoutSessionId: checkoutSession.id,
      deliveryMethod: order.deliveryMethod,
      itemCount: order.items.length,
    }),
  });

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

async function cleanupCheckoutFailure({
  checkoutSessionId,
  error,
  orderId,
  orderNumber,
  source,
  supabase,
}: {
  checkoutSessionId?: string;
  error: unknown;
  orderId: string;
  orderNumber: string;
  source: string;
  supabase: ReturnType<typeof createSupabaseServiceClient>;
}) {
  await notifyAdminError({
    title: "Checkout Stripe przerwany i wymagał cofnięcia zamówienia",
    source,
    error,
    context: {
      checkoutSessionId,
      orderId,
      orderNumber,
    },
  });

  if (checkoutSessionId) {
    try {
      await getStripeClient().checkout.sessions.expire(checkoutSessionId);
    } catch (expireError) {
      console.error("Failed to expire orphaned Stripe session", expireError);
      await notifyAdminError({
        title: "Nie udało się wygasić osieroconej sesji Stripe Checkout",
        source: `${source}.expireStripeSession`,
        error: expireError,
        context: {
          checkoutSessionId,
          orderId,
          orderNumber,
        },
      });
    }
  }

  const { error: cancelError } = await supabase
    .rpc("cancel_order_and_restore_stock", {
      p_checkout_session_id: checkoutSessionId ?? null,
      p_order_id: orderId,
    })
    .single();

  if (cancelError) {
    console.error("Failed to cancel order after checkout failure", cancelError);
    await notifyAdminError({
      title: "Nie udało się cofnąć zamówienia po błędzie checkoutu",
      source: `${source}.cancelOrderAndRestoreStock`,
      error: cancelError,
      context: {
        checkoutSessionId,
        orderId,
        orderNumber,
      },
    });
  }
}
