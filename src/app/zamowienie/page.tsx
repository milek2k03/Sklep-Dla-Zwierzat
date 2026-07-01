import type { Metadata } from "next";
import { OrderForm } from "@/components/OrderForm";

export const metadata: Metadata = {
  title: "Zamówienie | Pawly",
};

export default function OrderPage() {
  return <OrderForm />;
}
