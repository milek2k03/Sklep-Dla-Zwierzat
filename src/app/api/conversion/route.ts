import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  asJsonObject,
  recordConversionEvent,
  type ConversionEventType,
} from "@/lib/conversion";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getClientIp,
  rejectCrossOriginRequest,
  rejectLargeRequest,
} from "@/lib/security";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";

const conversionPayloadSchema = z.object({
  eventType: z.enum([
    "page_view",
    "product_view",
    "add_to_cart",
    "checkout_started",
    "order_created",
    "order_paid",
  ]),
  visitorId: z.string().trim().min(4).max(120),
  sessionId: z.string().trim().min(4).max(120),
  pagePath: z.string().trim().max(500).optional().nullable(),
  pageTitle: z.string().trim().max(220).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  productSlug: z.string().trim().max(160).optional().nullable(),
  productName: z.string().trim().max(220).optional().nullable(),
  productCategory: z.string().trim().max(120).optional().nullable(),
  orderNumber: z.string().trim().max(80).optional().nullable(),
  amount: z.number().finite().min(0).max(999999).optional().nullable(),
  quantity: z.number().int().positive().max(999).optional().nullable(),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export async function POST(request: NextRequest) {
  const invalidOrigin = rejectCrossOriginRequest(request);

  if (invalidOrigin) {
    return invalidOrigin;
  }

  const tooLarge = rejectLargeRequest(request, 8 * 1024);

  if (tooLarge) {
    return tooLarge;
  }

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`conversion:${ip}`, {
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsedPayload = conversionPayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 422 });
  }

  const data = parsedPayload.data;

  await recordConversionEvent({
    event_type: data.eventType as ConversionEventType,
    visitor_id: data.visitorId,
    session_id: data.sessionId,
    page_path: data.pagePath || null,
    page_title: data.pageTitle || null,
    referrer: data.referrer || null,
    product_slug: data.productSlug || null,
    product_name: data.productName || null,
    product_category: data.productCategory || null,
    order_number: data.orderNumber || null,
    amount: data.amount ?? null,
    quantity: data.quantity ?? null,
    metadata: asJsonObject(data.metadata ?? {}),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
