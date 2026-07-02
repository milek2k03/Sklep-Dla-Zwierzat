"use client";

import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/lib/cart-store";
import { getAvailableStock } from "@/lib/inventory";
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
  const availableStock = getAvailableStock(product);
  const isUnavailable = availableStock <= 0;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d] focus:outline-none focus:ring-2 focus:ring-[#e86f2c] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#8a8177] disabled:hover:bg-[#8a8177]",
        className,
      )}
      disabled={isUnavailable}
      onClick={() => {
        const result = addItem(product, quantity);

        if (result.added <= 0) {
          toast.warning("Nie można dodać więcej sztuk", {
            description:
              result.stock <= 0
                ? "Produkt jest aktualnie niedostępny."
                : `W koszyku masz już maksymalną dostępną ilość: ${result.stock}.`,
          });
          return;
        }

        if (result.added < result.requested) {
          toast.warning("Dodano tylko dostępne sztuki", {
            description: `W koszyku masz teraz ${result.quantityInCart} z ${result.stock} dostępnych sztuk.`,
          });
          return;
        }

        toast.success("Dodano do koszyka", {
          description: `${product.name} jest już w koszyku.`,
        });
      }}
    >
      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
      {isUnavailable ? "Brak w magazynie" : label}
    </button>
  );
}
