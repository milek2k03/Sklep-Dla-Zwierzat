import type { Database } from "@/types/supabase";

export type OrderStatus = Database["public"]["Tables"]["orders"]["Row"]["status"];

export const orderStatuses = [
  "new",
  "confirmed",
  "paid",
  "shipped",
  "cancelled",
] as const satisfies readonly OrderStatus[];

export const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Nowe",
  confirmed: "Potwierdzone",
  paid: "Opłacone",
  shipped: "Wysłane",
  cancelled: "Anulowane",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    orderStatuses.includes(value as OrderStatus)
  );
}

export function canTransitionOrderStatus(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
) {
  if (fromStatus === toStatus) {
    return true;
  }

  const transitions: Record<OrderStatus, OrderStatus[]> = {
    new: ["confirmed", "paid", "cancelled"],
    confirmed: ["paid", "cancelled"],
    paid: ["shipped"],
    shipped: [],
    cancelled: [],
  };

  return transitions[fromStatus].includes(toStatus);
}
