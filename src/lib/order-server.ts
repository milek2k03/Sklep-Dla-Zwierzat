import { z } from "zod";
import { getDeliveryCost } from "@/lib/delivery";
import { getProductBySlug } from "@/lib/products";
import type { CartItem, DeliveryMethod } from "@/types/cart";
import type { LocalOrder } from "@/types/order";

export const orderRequestSchema = z
  .object({
    fullName: z.string().min(3).max(120),
    email: z.string().email().max(180),
    phone: z.string().min(7).max(40).regex(/^[0-9+\-\s()]+$/),
    deliveryMethod: z.enum([
      "inpost-paczkomat",
      "inpost-kurier",
      "dpd-kurier",
      "odbior-lokalny",
    ]),
    address: z.string().min(5).max(600),
    pickupPoint: z.string().max(120).optional(),
    notes: z.string().max(1000).optional(),
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
    if (
      data.deliveryMethod === "inpost-paczkomat" &&
      !data.pickupPoint?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["pickupPoint"],
        message: "Numer paczkomatu jest wymagany.",
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

export function buildVerifiedOrder(
  input: OrderRequest,
  orderNumber: string,
): LocalOrder {
  const missingSlugs = new Set<string>();
  const items = input.items.reduce<CartItem[]>((acc, requestedItem) => {
    const product = getProductBySlug(requestedItem.slug);

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

  const subtotal = roundMoney(
    items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0,
    ),
  );
  const deliveryCost = getDeliveryCost(input.deliveryMethod, subtotal);
  const total = roundMoney(subtotal + deliveryCost);

  return {
    id: orderNumber,
    createdAt: new Date().toISOString(),
    customer: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      pickupPoint: input.pickupPoint?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    },
    deliveryMethod: input.deliveryMethod as DeliveryMethod,
    deliveryCost,
    subtotal,
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
