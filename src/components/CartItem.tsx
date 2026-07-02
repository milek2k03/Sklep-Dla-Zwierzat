"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { QuantitySelector } from "@/components/QuantitySelector";
import { formatPrice } from "@/lib/format";
import { useCartStore } from "@/lib/cart-store";
import { getAvailableStock, getStockLabel } from "@/lib/inventory";
import type { CartItem as CartItemType } from "@/types/cart";

type CartItemProps = {
  item: CartItemType;
};

export function CartItem({ item }: CartItemProps) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const availableStock = getAvailableStock(item.product);
  const stockLabel = getStockLabel(item.product);

  return (
    <article className="grid gap-4 border-b border-[#eee7db] py-5 last:border-b-0 sm:grid-cols-[116px_1fr_auto] sm:items-center">
      <Link href={`/produkt/${item.product.slug}`} className="block">
        <ProductImagePlaceholder
          product={item.product}
          className="aspect-square"
        />
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8a8177]">
          {item.product.category} • ID: {item.product.id}
        </p>
        <Link
          href={`/produkt/${item.product.slug}`}
          className="mt-1 block text-lg font-semibold text-[#1f1f1f] transition hover:text-[#b65320]"
        >
          {item.product.name}
        </Link>
        <p className="mt-2 text-sm text-[#6d675f]">
          {formatPrice(item.product.price)} za sztukę
        </p>
        {stockLabel ? (
          <p className="mt-2 text-sm font-semibold text-[#b65320]">
            {stockLabel}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-col sm:items-end">
        {availableStock > 0 ? (
          <QuantitySelector
            value={item.quantity}
            max={availableStock}
            onChange={(quantity) => updateQuantity(item.product.slug, quantity)}
          />
        ) : (
          <p className="rounded-full bg-[#fff1e8] px-3 py-2 text-sm font-semibold text-[#b65320]">
            Niedostępny
          </p>
        )}
        <div className="flex items-center gap-4">
          <span className="min-w-24 text-right text-base font-semibold text-[#1f1f1f]">
            {formatPrice(item.product.price * item.quantity)}
          </span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfd4] text-[#7a3b2a] transition hover:border-[#7a3b2a] hover:bg-[#fff1e8]"
            onClick={() => removeItem(item.product.slug)}
            aria-label={`Usuń ${item.product.name} z koszyka`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
