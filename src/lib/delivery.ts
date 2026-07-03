import type { DeliveryMethod, DeliveryOption } from "@/types/cart";
import { normalizeShippingCarrier } from "@/lib/tracking";

export const FREE_DELIVERY_THRESHOLD = 199;

export const deliveryMethodValues = [
  "inpost-paczkomat",
  "inpost-kurier",
  "dpd-kurier",
  "dpd-paczkomat",
] as const satisfies readonly DeliveryMethod[];

const pickupDeliveryMethods = [
  "inpost-paczkomat",
  "dpd-paczkomat",
] as const satisfies readonly DeliveryMethod[];

export const deliveryOptions: DeliveryOption[] = [
  {
    id: "inpost-paczkomat",
    name: "InPost Paczkomat",
    price: 0.01,
    description: "Odbiór w wybranym paczkomacie.",
  },
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
  {
    id: "dpd-paczkomat",
    name: "DPD Pickup / automat",
    price: 0.01,
    description: "Odbiór w punkcie lub automacie DPD.",
  },
];

export function getDeliveryOption(method: DeliveryMethod) {
  return deliveryOptions.find((option) => option.id === method) ?? deliveryOptions[0];
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

export function requiresPickupPoint(method: DeliveryMethod) {
  return pickupDeliveryMethods.some((pickupMethod) => pickupMethod === method);
}

export function getPickupPointLabel(method: DeliveryMethod) {
  if (method === "inpost-paczkomat") {
    return "Kod Paczkomatu InPost";
  }

  if (method === "dpd-paczkomat") {
    return "Kod punktu lub automatu DPD";
  }

  return "Punkt odbioru";
}

export function getPickupPointPlaceholder(method: DeliveryMethod) {
  if (method === "inpost-paczkomat") {
    return "np. TOR01A";
  }

  if (method === "dpd-paczkomat") {
    return "np. WAR01";
  }

  return "";
}

export function normalizePickupPointCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function getPickupPointCodeError(
  method: DeliveryMethod,
  value: string | undefined,
) {
  const normalizedValue = normalizePickupPointCode(value ?? "");

  if (!normalizedValue) {
    return "Punkt odbioru jest wymagany.";
  }

  if (method === "inpost-paczkomat" && !/^[A-Z]{3}[0-9]{2}[A-Z0-9]?$/.test(normalizedValue)) {
    return "Kod Paczkomatu InPost powinien wyglądać np. TOR01A.";
  }

  if (method === "dpd-paczkomat" && !/^[A-Z]{3}[0-9]{2,3}$/.test(normalizedValue)) {
    return "Kod punktu DPD powinien wyglądać np. WAR01 albo WAR123.";
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
