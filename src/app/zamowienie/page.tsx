import type { Metadata } from "next";
import { OrderForm } from "@/components/OrderForm";
import { storeBrandName } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Zamówienie | ${storeBrandName}`,
};

export default function OrderPage() {
  return <OrderForm />;
}
