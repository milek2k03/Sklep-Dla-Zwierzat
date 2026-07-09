"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ProductPriceHintProps = {
  field: "price" | "purchasePrice" | "compareAtPrice";
};

type HintState = {
  message: string;
  tone: "neutral" | "error";
};

const neutralHints: Record<ProductPriceHintProps["field"], string> = {
  price: "Nie może być niższa niż cena zakupu.",
  purchasePrice: "Nie może być wyższa niż cena sprzedaży.",
  compareAtPrice:
    "Stara cena widoczna jako przekreślona. Musi być większa niż cena sprzedaży.",
};

export function ProductPriceHint({ field }: ProductPriceHintProps) {
  const hintRef = useRef<HTMLSpanElement>(null);
  const [hint, setHint] = useState<HintState>({
    message: neutralHints[field],
    tone: "neutral",
  });

  useEffect(() => {
    const form = hintRef.current?.closest("form");

    if (!form) {
      return;
    }

    const priceInput = form.elements.namedItem("price");
    const purchaseInput = form.elements.namedItem("purchasePrice");
    const compareInput = form.elements.namedItem("compareAtPrice");

    if (
      !(priceInput instanceof HTMLInputElement) ||
      !(purchaseInput instanceof HTMLInputElement) ||
      !(compareInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const updateHint = () => {
      const price = parseNumber(priceInput.value);
      const purchasePrice = parseNumber(purchaseInput.value);
      const compareAtPrice = parseNumber(compareInput.value);

      setHint(getHint(field, price, purchasePrice, compareAtPrice));
    };

    updateHint();
    priceInput.addEventListener("input", updateHint);
    purchaseInput.addEventListener("input", updateHint);
    compareInput.addEventListener("input", updateHint);
    form.addEventListener("reset", updateHint);

    return () => {
      priceInput.removeEventListener("input", updateHint);
      purchaseInput.removeEventListener("input", updateHint);
      compareInput.removeEventListener("input", updateHint);
      form.removeEventListener("reset", updateHint);
    };
  }, [field]);

  return (
    <span
      ref={hintRef}
      className={cn(
        "mt-2 block text-xs leading-5",
        hint.tone === "error" ? "font-semibold text-[#f19988]" : "text-[#6d675f]",
      )}
      aria-live="polite"
    >
      {hint.message}
    </span>
  );
}

function getHint(
  field: ProductPriceHintProps["field"],
  price: number | null,
  purchasePrice: number | null,
  compareAtPrice: number | null,
): HintState {
  if (field === "price") {
    if (price !== null && purchasePrice !== null && price < purchasePrice) {
      return {
        message: "Cena sprzedaży nie może być niższa niż cena zakupu.",
        tone: "error",
      };
    }

    return { message: neutralHints.price, tone: "neutral" };
  }

  if (field === "purchasePrice") {
    if (price !== null && purchasePrice !== null && purchasePrice > price) {
      return {
        message: "Cena zakupu nie może być wyższa niż cena sprzedaży.",
        tone: "error",
      };
    }

    return { message: neutralHints.purchasePrice, tone: "neutral" };
  }

  if (compareAtPrice !== null && price !== null && compareAtPrice <= price) {
    return {
      message: "Cena przekreślona musi być większa niż cena sprzedaży.",
      tone: "error",
    };
  }

  if (
    compareAtPrice !== null &&
    purchasePrice !== null &&
    compareAtPrice < purchasePrice
  ) {
    return {
      message: "Cena przekreślona nie może być niższa niż cena zakupu.",
      tone: "error",
    };
  }

  return { message: neutralHints.compareAtPrice, tone: "neutral" };
}

function parseNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
