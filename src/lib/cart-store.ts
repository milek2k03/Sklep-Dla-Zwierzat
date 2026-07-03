"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import type { CartItem, DeliveryMethod } from "@/types/cart";
import type { Product } from "@/types/product";
import { clampQuantityToStock, getAvailableStock } from "@/lib/inventory";

type AddItemResult = {
  added: number;
  requested: number;
  stock: number;
  quantityInCart: number;
};

type CartState = {
  items: CartItem[];
  deliveryMethod: DeliveryMethod;
  addItem: (product: Product, quantity?: number) => AddItemResult;
  removeItem: (slug: string) => void;
  setDeliveryMethod: (method: DeliveryMethod) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemsCount: () => number;
};

function normalizeQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.max(1, Math.floor(quantity));
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      deliveryMethod: "inpost-paczkomat",
      addItem: (product, quantity = 1) => {
        const requestedQuantity = normalizeQuantity(quantity);
        const stock = getAvailableStock(product);
        let result: AddItemResult = {
          added: 0,
          requested: requestedQuantity,
          stock,
          quantityInCart: 0,
        };

        set((state) => {
          const existingItem = state.items.find(
            (item) => item.product.slug === product.slug,
          );
          const existingQuantity = existingItem?.quantity ?? 0;
          const capacity = Math.max(0, stock - existingQuantity);
          const addedQuantity = Math.min(requestedQuantity, capacity);
          const quantityInCart = existingQuantity + addedQuantity;

          result = {
            added: addedQuantity,
            requested: requestedQuantity,
            stock,
            quantityInCart,
          };

          if (addedQuantity <= 0) {
            return state;
          }

          if (!existingItem) {
            return {
              items: [
                ...state.items,
                { product, quantity: clampQuantityToStock(product, addedQuantity) },
              ],
            };
          }

          return {
            items: state.items.map((item) =>
              item.product.slug === product.slug
                ? { ...item, product, quantity: quantityInCart }
                : item,
            ),
          };
        });

        return result;
      },
      removeItem: (slug) => {
        set((state) => ({
          items: state.items.filter((item) => item.product.slug !== slug),
        }));
      },
      setDeliveryMethod: (method) => {
        set({ deliveryMethod: method });
      },
      updateQuantity: (slug, quantity) => {
        const nextQuantity = Math.floor(quantity);

        set((state) => {
          if (nextQuantity <= 0) {
            return {
              items: state.items.filter((item) => item.product.slug !== slug),
            };
          }

          return {
            items: state.items.flatMap((item) => {
              if (item.product.slug !== slug) {
                return [item];
              }

              const cappedQuantity = Math.min(
                nextQuantity,
                getAvailableStock(item.product),
                99,
              );

              return cappedQuantity > 0
                ? [{ ...item, quantity: cappedQuantity }]
                : [];
            }),
          };
        });
      },
      clearCart: () => set({ items: [] }),
      getTotal: () =>
        get().items.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0,
        ),
      getItemsCount: () =>
        get().items.reduce((total, item) => total + item.quantity, 0),
    }),
    {
      name: "pawly-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        deliveryMethod: state.deliveryMethod,
        items: state.items,
      }),
    },
  ),
);

export function useCartHydrated() {
  return useSyncExternalStore(
    (onStoreChange) => useCartStore.persist.onFinishHydration(onStoreChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}
