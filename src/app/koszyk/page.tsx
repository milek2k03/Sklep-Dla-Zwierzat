import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
import { storeBrandName } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Koszyk | ${storeBrandName}`,
};

export default function CartPage() {
  return <CartView />;
}
