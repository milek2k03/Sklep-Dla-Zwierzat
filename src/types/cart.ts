import type { Product } from "@/types/product";

export type CartItem = {
  product: Product;
  quantity: number;
};

export type DeliveryMethod =
  | "inpost-paczkomat"
  | "inpost-kurier"
  | "dpd-kurier"
  | "dpd-paczkomat";

export type DeliveryOption = {
  id: DeliveryMethod;
  name: string;
  price: number;
  description: string;
};
