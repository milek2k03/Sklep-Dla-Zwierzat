"use client";

import { useEffect, useRef } from "react";
import { trackConversionEvent } from "@/lib/conversion-client";

type ProductViewTrackerProps = {
  product: {
    slug: string;
    name: string;
    category: string;
    price: number;
  };
};

export function ProductViewTracker({ product }: ProductViewTrackerProps) {
  const trackedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (trackedSlugRef.current === product.slug) {
      return;
    }

    trackedSlugRef.current = product.slug;
    trackConversionEvent({
      eventType: "product_view",
      productSlug: product.slug,
      productName: product.name,
      productCategory: product.category,
      amount: product.price,
    });
  }, [product]);

  return null;
}
