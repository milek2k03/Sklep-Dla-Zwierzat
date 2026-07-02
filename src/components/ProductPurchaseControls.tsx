"use client";

import { useState } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { QuantitySelector } from "@/components/QuantitySelector";
import { clampQuantityToStock, getAvailableStock } from "@/lib/inventory";
import type { Product } from "@/types/product";

type ProductPurchaseControlsProps = {
  product: Product;
};

export function ProductPurchaseControls({
  product,
}: ProductPurchaseControlsProps) {
  const [quantity, setQuantity] = useState(1);
  const availableStock = getAvailableStock(product);
  const selectedQuantity =
    availableStock > 0 ? clampQuantityToStock(product, quantity) : 1;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {availableStock > 0 ? (
        <QuantitySelector
          value={selectedQuantity}
          onChange={setQuantity}
          max={availableStock}
        />
      ) : null}
      <AddToCartButton
        product={product}
        quantity={selectedQuantity}
        className="w-full bg-[#e86f2c] hover:bg-[#cf5f25] sm:flex-1"
      />
    </div>
  );
}
