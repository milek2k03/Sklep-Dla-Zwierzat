import { z } from "zod";
import {
  formatDeliveryAddress,
  isPolishPostalCode,
  normalizePolishPostalCode,
  DELIVERY_COUNTRY,
} from "@/lib/address";
import {
  deliveryMethodValues,
  getDeliveryCost,
} from "@/lib/delivery";
import {
  applyDiscountToItems,
  normalizeDiscountCode,
  type DiscountCodeRow,
} from "@/lib/discounts";
import { getAvailableStock } from "@/lib/inventory";
import { getProductBySlug, products } from "@/lib/products";
import type { CartItem, DeliveryMethod } from "@/types/cart";
import type { LocalOrder } from "@/types/order";
import type { Product } from "@/types/product";

export const orderRequestSchema = z
  .object({
    fullName: z.string().min(3).max(120),
    email: z.string().email().max(180),
    phone: z.string().min(7).max(40).regex(/^[0-9+\-\s()]+$/),
    deliveryMethod: z.enum(deliveryMethodValues),
    city: z.string().max(100).optional(),
    street: z.string().max(140).optional(),
    buildingNumber: z.string().max(40).optional(),
    postalCode: z.string().max(12).optional(),
    notes: z.string().max(1000).optional(),
    discountCode: z.string().max(40).optional(),
    termsAccepted: z.literal(true),
    items: z
      .array(
        z.object({
          slug: z.string().min(1).max(120),
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((data, context) => {
    const requiredAddressFields = [
      ["city", data.city, "Miejscowość jest wymagana."],
      ["street", data.street, "Ulica jest wymagana."],
      [
        "buildingNumber",
        data.buildingNumber,
        "Numer domu / mieszkania jest wymagany.",
      ],
      ["postalCode", data.postalCode, "Kod pocztowy jest wymagany."],
    ] as const;

    requiredAddressFields.forEach(([field, value, message]) => {
      if (!value?.trim()) {
        context.addIssue({
          code: "custom",
          path: [field],
          message,
        });
      }
    });

    if (data.postalCode?.trim() && !isPolishPostalCode(data.postalCode)) {
      context.addIssue({
        code: "custom",
        path: ["postalCode"],
        message: "Podaj kod pocztowy w formacie 00-000.",
      });
    }
  });

export type OrderRequest = z.infer<typeof orderRequestSchema>;

export class UnknownOrderProductsError extends Error {
  readonly slugs: string[];

  constructor(slugs: string[]) {
    super("UNKNOWN_ORDER_PRODUCTS");
    this.name = "UnknownOrderProductsError";
    this.slugs = slugs;
  }
}

export class InsufficientOrderStockError extends Error {
  readonly items: Array<{
    slug: string;
    requested: number;
    available: number;
  }>;

  constructor(
    items: Array<{ slug: string; requested: number; available: number }>,
  ) {
    super("INSUFFICIENT_ORDER_STOCK");
    this.name = "InsufficientOrderStockError";
    this.items = items;
  }
}

export function buildVerifiedOrder(
  input: OrderRequest,
  orderNumber: string,
  productCatalog: Product[] = products,
  discount: DiscountCodeRow | null = null,
): LocalOrder {
  const canUseStaticFallback = productCatalog === products;
  const missingSlugs = new Set<string>();
  const items = input.items.reduce<CartItem[]>((acc, requestedItem) => {
    const product =
      productCatalog.find((catalogProduct) => catalogProduct.slug === requestedItem.slug) ??
      (canUseStaticFallback ? getProductBySlug(requestedItem.slug) : undefined);

    if (!product) {
      missingSlugs.add(requestedItem.slug);
      return acc;
    }

    const existingItem = acc.find((item) => item.product.slug === product.slug);

    if (existingItem) {
      existingItem.quantity += requestedItem.quantity;
      return acc;
    }

    acc.push({
      product,
      quantity: requestedItem.quantity,
    });

    return acc;
  }, []);

  if (missingSlugs.size > 0) {
    throw new UnknownOrderProductsError([...missingSlugs]);
  }

  if (items.length === 0) {
    throw new Error("ORDER_HAS_NO_VALID_ITEMS");
  }

  const insufficientItems = items
    .map((item) => ({
      slug: item.product.slug,
      requested: item.quantity,
      available: getAvailableStock(item.product),
    }))
    .filter((item) => item.requested > item.available);

  if (insufficientItems.length > 0) {
    throw new InsufficientOrderStockError(insufficientItems);
  }

  const subtotal = roundMoney(
    items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0,
    ),
  );
  const appliedDiscount = input.discountCode
    ? applyDiscountToItems(discount, items)
    : null;
  const discountTotal = appliedDiscount?.total ?? 0;
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - discountTotal));
  const deliveryCost = getDeliveryCost(input.deliveryMethod, discountedSubtotal);
  const total = roundMoney(discountedSubtotal + deliveryCost);
  const city = input.city?.trim();
  const street = input.street?.trim();
  const buildingNumber = input.buildingNumber?.trim();
  const postalCode = input.postalCode
    ? normalizePolishPostalCode(input.postalCode)
    : undefined;
  const address = formatDeliveryAddress({
    street,
    buildingNumber,
    postalCode,
    city,
  });

  return {
    id: orderNumber,
    createdAt: new Date().toISOString(),
    customer: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      address,
      city,
      street,
      buildingNumber,
      postalCode,
      country: DELIVERY_COUNTRY,
      notes: input.notes?.trim() || undefined,
    },
    deliveryMethod: input.deliveryMethod as DeliveryMethod,
    deliveryCost,
    subtotal,
    discountCode: appliedDiscount?.code ?? normalizeDiscountCode(input.discountCode),
    discountPercent: appliedDiscount?.percent,
    discountTotal,
    total,
    items,
  };
}

export function createOrderNumber() {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase();

  return `PAWLY-${timestampPart}-${randomPart}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
