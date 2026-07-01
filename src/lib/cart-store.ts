"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import type { CartItem } from "@/types/cart";
import type { Product } from "@/types/product";

type CartState = {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (slug: string) => void;
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
      addItem: (product, quantity = 1) => {
        const nextQuantity = normalizeQuantity(quantity);

        set((state) => {
          const existingItem = state.items.find(
            (item) => item.product.slug === product.slug,
          );

          if (!existingItem) {
            return {
              items: [...state.items, { product, quantity: nextQuantity }],
            };
          }

          return {
            items: state.items.map((item) =>
              item.product.slug === product.slug
                ? { ...item, quantity: item.quantity + nextQuantity }
                : item,
            ),
          };
        });
      },
      removeItem: (slug) => {
        set((state) => ({
          items: state.items.filter((item) => item.product.slug !== slug),
        }));
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
            items: state.items.map((item) =>
              item.product.slug === slug
                ? { ...item, quantity: Math.min(nextQuantity, 99) }
                : item,
            ),
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
      partialize: (state) => ({ items: state.items }),
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
