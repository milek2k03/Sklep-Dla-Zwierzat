import type { DeliveryMethod, DeliveryOption } from "@/types/cart";

export const FREE_DELIVERY_THRESHOLD = 199;

export const deliveryOptions: DeliveryOption[] = [
  {
    id: "inpost-paczkomat",
    name: "InPost Paczkomat",
    price: 15.99,
    description: "Odbiór w wybranym paczkomacie.",
  },
  {
    id: "inpost-kurier",
    name: "InPost Kurier",
    price: 17.99,
    description: "Dostawa kurierem pod wskazany adres.",
  },
  {
    id: "dpd-kurier",
    name: "DPD Kurier",
    price: 18.99,
    description: "Klasyczna przesyłka kurierska.",
  },
  {
    id: "odbior-lokalny",
    name: "Odbiór lokalny",
    price: 0,
    description: "Odbiór osobisty po potwierdzeniu zamówienia.",
  },
];

export function getDeliveryOption(method: DeliveryMethod) {
  return deliveryOptions.find((option) => option.id === method) ?? deliveryOptions[0];
}

export function getDeliveryCost(method: DeliveryMethod, subtotal: number) {
  const option = getDeliveryOption(method);

  if (option.price === 0 || subtotal >= FREE_DELIVERY_THRESHOLD) {
    return 0;
  }

  return option.price;
}
