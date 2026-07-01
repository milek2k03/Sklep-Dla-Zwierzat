"use client";

import { useState } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { QuantitySelector } from "@/components/QuantitySelector";
import type { Product } from "@/types/product";

type ProductPurchaseControlsProps = {
  product: Product;
};

export function ProductPurchaseControls({
  product,
}: ProductPurchaseControlsProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <QuantitySelector value={quantity} onChange={setQuantity} />
      <AddToCartButton
        product={product}
        quantity={quantity}
        className="w-full bg-[#e86f2c] hover:bg-[#cf5f25] sm:flex-1"
      />
    </div>
  );
}
