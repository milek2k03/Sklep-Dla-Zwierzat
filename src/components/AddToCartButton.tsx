"use client";

import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/lib/cart-store";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

type AddToCartButtonProps = {
  product: Product;
  quantity?: number;
  label?: string;
  className?: string;
};

export function AddToCartButton({
  product,
  quantity = 1,
  label = "Dodaj do koszyka",
  className,
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d] focus:outline-none focus:ring-2 focus:ring-[#e86f2c] focus:ring-offset-2",
        className,
      )}
      onClick={() => {
        addItem(product, quantity);
        toast.success("Dodano do koszyka", {
          description: `${product.name} jest już w koszyku.`,
        });
      }}
    >
      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
