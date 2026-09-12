"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useEffect, useSyncExternalStore } from "react";
import type { CartItem, DeliveryMethod } from "@/types/cart";
import type { Product } from "@/types/product";
import { clampQuantityToStock, getAvailableStock } from "@/lib/inventory";
import { DEFAULT_DELIVERY_METHOD, isDeliveryMethod } from "@/lib/delivery";

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

const cartStorageKey = "pawly-cart";
const cartChangedEvent = "pawly-cart:changed";

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
      deliveryMethod: DEFAULT_DELIVERY_METHOD,
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

        if (result.added > 0) {
          notifyCartChanged();
        }

        return result;
      },
      removeItem: (slug) => {
        set((state) => ({
          items: state.items.filter((item) => item.product.slug !== slug),
        }));
        notifyCartChanged();
      },
      setDeliveryMethod: (method) => {
        set({ deliveryMethod: method });
        notifyCartChanged();
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
        notifyCartChanged();
      },
      clearCart: () => {
        set({ items: [] });
        notifyCartChanged();
      },
      getTotal: () =>
        get().items.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0,
        ),
      getItemsCount: () =>
        get().items.reduce((total, item) => total + item.quantity, 0),
    }),
    {
      name: cartStorageKey,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        deliveryMethod: state.deliveryMethod,
        items: state.items,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<CartState>;

        return {
          ...currentState,
          ...persisted,
          deliveryMethod: isDeliveryMethod(persisted.deliveryMethod)
            ? persisted.deliveryMethod
            : DEFAULT_DELIVERY_METHOD,
        };
      },
    },
  ),
);

export function getCartItemsCount(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function useCartHydrated() {
  return useSyncExternalStore(
    (onStoreChange) => useCartStore.persist.onFinishHydration(onStoreChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}

export function useCartStorageSync() {
  useEffect(() => {
    const syncCart = () => {
      void Promise.resolve(useCartStore.persist.rehydrate()).catch(() => {
        // The current in-memory cart remains usable if browser storage is blocked.
      });
    };
    const syncVisibleCart = () => {
      if (document.visibilityState === "visible") {
        syncCart();
      }
    };
    const syncChangedStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === cartStorageKey) {
        syncCart();
      }
    };
    const syncLocalCartChange = () => {
      window.requestAnimationFrame(syncCart);
    };

    syncCart();
    window.addEventListener("pageshow", syncCart);
    window.addEventListener("focus", syncCart);
    window.addEventListener("storage", syncChangedStorage);
    window.addEventListener(cartChangedEvent, syncLocalCartChange);
    document.addEventListener("visibilitychange", syncVisibleCart);

    return () => {
      window.removeEventListener("pageshow", syncCart);
      window.removeEventListener("focus", syncCart);
      window.removeEventListener("storage", syncChangedStorage);
      window.removeEventListener(cartChangedEvent, syncLocalCartChange);
      document.removeEventListener("visibilitychange", syncVisibleCart);
    };
  }, []);
}

function notifyCartChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(cartChangedEvent));
}
