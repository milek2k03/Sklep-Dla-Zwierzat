import type { CartItem, DeliveryMethod } from "@/types/cart";

export type OrderCustomer = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  pickupPoint?: string;
  notes?: string;
};

export type LocalOrder = {
  id: string;
  createdAt: string;
  customer: OrderCustomer;
  deliveryMethod: DeliveryMethod;
  deliveryCost: number;
  subtotal: number;
  total: number;
  items: CartItem[];
};
