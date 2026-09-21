"use client";

import { Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { trackConversionEvent } from "@/lib/conversion-client";
import { useCartStore } from "@/lib/cart-store";
import { getAvailableStock } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

type AddToCartButtonProps = {
  product: Product;
  quantity?: number;
  label?: string;
  className?: string;
  variant?: "default" | "recommendation";
};

export function AddToCartButton({
  product,
  quantity = 1,
  label = "Dodaj do koszyka",
  className,
  variant = "default",
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const availableStock = getAvailableStock(product);
  const isUnavailable = availableStock <= 0;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#e86f2c] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#8a8177] disabled:text-white",
        variant === "recommendation"
          ? "h-9 w-9 shrink-0 rounded-full border border-[#d9a47f] bg-white text-[#a24e20] hover:border-[#b65320] hover:bg-[#fff1e5]"
          : "min-h-12 rounded-full bg-[#1f1f1f] px-5 text-sm text-white hover:bg-[#34302d]",
        className,
      )}
      disabled={isUnavailable}
      aria-label={variant === "recommendation" ? `Dodaj ${product.name} do koszyka` : undefined}
      title={variant === "recommendation" ? `Dodaj ${product.name} do koszyka` : undefined}
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
        trackConversionEvent({
          eventType: "add_to_cart",
          productSlug: product.slug,
          productName: product.name,
          productCategory: product.category,
          amount: product.price,
          quantity: result.added,
          metadata: {
            quantityInCart: result.quantityInCart,
            stock: result.stock,
          },
        });
      }}
    >
      {variant === "recommendation" ? <Plus className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
      {variant === "recommendation" ? null : isUnavailable ? "Brak w magazynie" : label}
    </button>
  );
}
