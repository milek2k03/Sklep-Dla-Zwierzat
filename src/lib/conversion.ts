import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";

export const conversionEventLabels = {
  page_view: "Wejście na stronę",
  product_view: "Widok produktu",
  add_to_cart: "Dodanie do koszyka",
  checkout_started: "Start zamówienia",
  order_created: "Utworzone zamówienie",
  order_paid: "Opłacone zamówienie",
} as const;

export type ConversionEventType = keyof typeof conversionEventLabels;

export const conversionFunnelSteps: Array<{
  eventType: ConversionEventType;
  label: string;
}> = [
  { eventType: "page_view", label: "Odwiedziny" },
  { eventType: "product_view", label: "Produkty" },
  { eventType: "add_to_cart", label: "Koszyk" },
  { eventType: "checkout_started", label: "Dane" },
  { eventType: "order_created", label: "Checkout" },
  { eventType: "order_paid", label: "Płatność" },
];

type ConversionEventInsert =
  Database["public"]["Tables"]["conversion_events"]["Insert"];

export async function recordConversionEvent(event: ConversionEventInsert) {
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("conversion_events").insert({
      ...event,
      metadata: event.metadata ?? {},
    });

    if (error) {
      console.error("Failed to record conversion event", error);
    }
  } catch (error) {
    console.error("Failed to record conversion event", error);
  }
}

export function buildSystemConversionIdentity(orderNumber: string) {
  return {
    visitor_id: `order:${orderNumber}`,
    session_id: `order:${orderNumber}`,
  };
}

export function getConversionEventAmount(event: {
  amount: number | null;
  event_type: ConversionEventType;
}) {
  return event.event_type === "order_paid" ? Number(event.amount ?? 0) : 0;
}

export function asJsonObject(value: Record<string, Json | undefined>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Json;
}
