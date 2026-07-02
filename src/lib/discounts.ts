import type { CartItem } from "@/types/cart";
import type { ProductCategory } from "@/types/product";
import type { Database } from "@/types/supabase";

export type DiscountCodeRow =
  Database["public"]["Tables"]["discount_codes"]["Row"];
export type DiscountScopeType = DiscountCodeRow["scope_type"];
export type DiscountTimeMode = DiscountCodeRow["time_mode"];

export type AppliedDiscount = {
  code: string;
  percent: number;
  total: number;
  appliesToCart: boolean;
};

const dayIndexes = [0, 1, 2, 3, 4, 5, 6];

export const discountScopeLabels: Record<DiscountScopeType, string> = {
  all: "Cały sklep",
  category: "Kolekcja",
  product: "Produkt",
};

export const discountTimeModeLabels: Record<DiscountTimeMode, string> = {
  permanent: "Stały",
  scheduled: "Ograniczony czasowo",
  recurring: "Cykliczny",
};

export const weekdayLabels = [
  { value: 1, label: "Pon" },
  { value: 2, label: "Wt" },
  { value: 3, label: "Śr" },
  { value: 4, label: "Czw" },
  { value: 5, label: "Pt" },
  { value: 6, label: "Sob" },
  { value: 0, label: "Nd" },
];

export function normalizeDiscountCode(code: string | undefined | null) {
  return code?.trim().toUpperCase().slice(0, 40) ?? "";
}

export function isDiscountActive(discount: DiscountCodeRow, now = new Date()) {
  if (!discount.is_active) {
    return false;
  }

  if (discount.time_mode === "permanent") {
    return true;
  }

  if (discount.time_mode === "scheduled") {
    if (!discount.starts_at || !discount.ends_at) {
      return false;
    }

    const startsAt = new Date(discount.starts_at);
    const endsAt = new Date(discount.ends_at);

    return startsAt <= now && now <= endsAt;
  }

  if (discount.time_mode === "recurring") {
    return discount.weekdays.includes(now.getDay());
  }

  return false;
}

export function calculateDiscountTotal(
  discount: DiscountCodeRow,
  items: CartItem[],
) {
  const eligibleSubtotal = items.reduce((total, item) => {
    if (!isItemEligible(discount, item)) {
      return total;
    }

    return total + item.product.price * item.quantity;
  }, 0);

  return roundMoney((eligibleSubtotal * discount.percent) / 100);
}

export function applyDiscountToItems(
  discount: DiscountCodeRow | null,
  items: CartItem[],
) {
  if (!discount || !isDiscountActive(discount)) {
    return null;
  }

  const total = calculateDiscountTotal(discount, items);
  const appliesToCart = total > 0 || discount.percent === 0;

  if (!appliesToCart) {
    return null;
  }

  return {
    code: discount.code,
    percent: discount.percent,
    total,
    appliesToCart,
  } satisfies AppliedDiscount;
}

export function serializeWeekdays(formData: FormData) {
  return formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((value) => dayIndexes.includes(value));
}

function isItemEligible(discount: DiscountCodeRow, item: CartItem) {
  if (discount.scope_type === "all") {
    return true;
  }

  if (discount.scope_type === "category") {
    return item.product.category === (discount.scope_value as ProductCategory);
  }

  if (discount.scope_type === "product") {
    return item.product.id === discount.scope_value;
  }

  return false;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
