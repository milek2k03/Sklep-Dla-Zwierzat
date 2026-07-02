import type { Product } from "@/types/product";

export function getAvailableStock(product: Product) {
  const stock = product.stockQuantity;

  if (typeof stock !== "number" || !Number.isFinite(stock)) {
    return 0;
  }

  return Math.max(0, Math.floor(stock));
}

export function getStockLabel(product: Product) {
  const stock = getAvailableStock(product);

  if (stock <= 0) {
    return "Brak w magazynie";
  }

  if (stock === 1) {
    return "Ostatnia sztuka";
  }

  if (stock < 5) {
    return "Ostatnie sztuki";
  }

  return null;
}

export function clampQuantityToStock(product: Product, quantity: number) {
  const stock = getAvailableStock(product);

  if (stock <= 0) {
    return 0;
  }

  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(quantity)), stock);
}
