import type { CartItem, DeliveryMethod } from "@/types/cart";

export type OrderCustomer = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  country: string;
  pickupPoint?: string;
  pickupPointName?: string;
  pickupPointAddressLine1?: string;
  pickupPointAddressLine2?: string;
  notes?: string;
};

export type LocalOrder = {
  id: string;
  createdAt: string;
  customer: OrderCustomer;
  deliveryMethod: DeliveryMethod;
  deliveryCost: number;
  subtotal: number;
  discountCode?: string;
  discountPercent?: number;
  discountTotal?: number;
  total: number;
  items: CartItem[];
};
