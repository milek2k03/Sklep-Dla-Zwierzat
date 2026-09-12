import type { DeliveryMethod, DeliveryOption } from "@/types/cart";
import { normalizeShippingCarrier } from "@/lib/tracking";

export const FREE_DELIVERY_THRESHOLD = 199;
export const DEFAULT_DELIVERY_METHOD = "inpost-kurier" as const;

export const deliveryMethodValues = [
  "inpost-kurier",
  "dpd-kurier",
] as const satisfies readonly DeliveryMethod[];

export const deliveryOptions: DeliveryOption[] = [
  {
    id: "inpost-kurier",
    name: "InPost Kurier",
    price: 0.01,
    description: "Dostawa kurierem pod wskazany adres.",
  },
  {
    id: "dpd-kurier",
    name: "DPD Kurier",
    price: 0.01,
    description: "Klasyczna przesyłka kurierska.",
  },
];

export function getDeliveryOption(method: DeliveryMethod) {
  return deliveryOptions.find((option) => option.id === method) ?? deliveryOptions[0];
}

export function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return deliveryMethodValues.some((method) => method === value);
}

export function getShippingCarrierForDeliveryMethod(
  method: string | null | undefined,
) {
  if (!method) {
    return null;
  }

  const normalizedMethod = method.toLowerCase();

  if (normalizedMethod.includes("inpost")) {
    return normalizeShippingCarrier("InPost");
  }

  if (normalizedMethod.includes("dpd")) {
    return normalizeShippingCarrier("DPD");
  }

  return null;
}

export function getDeliveryCost(method: DeliveryMethod, subtotal: number) {
  const option = getDeliveryOption(method);

  if (option.price === 0 || subtotal >= FREE_DELIVERY_THRESHOLD) {
    return 0;
  }

  return option.price;
}

export function getCheapestRegularDeliveryCost() {
  return money(
    Math.min(
      ...deliveryOptions.map((option) =>
        Number.isFinite(option.price) ? option.price : 0,
      ),
    ),
  );
}

export function getConsumerWithdrawalDeliveryRefundLimit(
  paidDeliveryCost: number,
) {
  return money(
    Math.min(
      Math.max(0, paidDeliveryCost),
      getCheapestRegularDeliveryCost(),
    ),
  );
}

function money(value: number) {
  return Math.round(Number(value) * 100) / 100;
}
