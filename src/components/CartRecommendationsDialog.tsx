"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ShoppingBag, X } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/product";

export function CartRecommendationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useCartStore((state) => state.items);
  const [result, setResult] = useState<{ key: string; products: Product[]; error: boolean } | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const slugs = items.map((item) => item.product.slug).join("|");
  const loading = result?.key !== slugs;
  const products = result?.products ?? [];
  const error = result?.error ?? false;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!slugs) return;
    const controller = new AbortController();
    fetch("/api/products/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: slugs.split("|") }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Recommendations unavailable");
        return response.json() as Promise<{ products: Product[] }>;
      })
      .then((payload) => setResult({ key: slugs, products: payload.products, error: false }))
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setResult({ key: slugs, products: [], error: true });
      });
    return () => controller.abort();
  }, [slugs]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#171615]/65 px-4 py-5" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="cart-recommendations-title" className="flex max-h-[min(90dvh,850px)] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-[#fffdf8] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e8dfd2] px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase text-[#b65320]">Do Twojego koszyka</p>
            <h2 id="cart-recommendations-title" className="mt-1 text-xl font-semibold text-[#1f1f1f] sm:text-2xl">Może przydać się także</h2>
          </div>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Zamknij propozycje" title="Zamknij" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ddd3c4] bg-white hover:bg-[#f5efe5]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
          {loading ? <div role="status" aria-label="Ładowanie propozycji" className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex h-28 animate-pulse gap-3 rounded-lg border border-[#e8dfd2] bg-white p-3"><div className="aspect-square h-full rounded bg-[#f1e9dd]" /><div className="flex flex-1 flex-col gap-2 py-2"><div className="h-3 w-1/3 rounded bg-[#f1e9dd]" /><div className="h-4 w-4/5 rounded bg-[#f1e9dd]" /><div className="mt-auto h-7 w-20 rounded-full bg-[#f1e9dd]" /></div></div>)}</div> : error ? <p className="py-12 text-center text-sm text-[#6d675f]">Nie udało się pobrać propozycji.</p> : products.length === 0 ? <p className="py-12 text-center text-sm text-[#6d675f]">Wszystkie dostępne produkty są już w koszyku.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {products.map((product) => (
                <article key={product.slug} className="flex min-w-0 gap-3 rounded-lg border border-[#e8dfd2] bg-white p-3">
                  <Link href={`/produkt/${product.slug}`} onClick={onClose} className="w-20 shrink-0 self-start sm:w-24" aria-label={`Zobacz ${product.name}`}>
                    <ProductImagePlaceholder product={product} className="aspect-square" showCategoryBadge={false} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-xs text-[#7a746d]">{product.category}</p>
                    <Link href={`/produkt/${product.slug}`} onClick={onClose} className="mt-1 line-clamp-2 text-sm font-semibold text-[#1f1f1f] hover:underline">{product.name}</Link>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <p className="min-w-0 text-sm font-semibold text-[#1f1f1f]">{formatPrice(product.price)}</p>
                      <AddToCartButton product={product} variant="recommendation" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[#e8dfd2] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-[#ddd3c4] px-5 text-sm font-semibold text-[#1f1f1f] hover:bg-[#f5efe5]">Kontynuuj zakupy</button>
          {loading ? <button type="button" disabled className="inline-flex min-h-11 cursor-wait items-center justify-center gap-2 rounded-full bg-[#a9a39b] px-5 text-sm font-semibold text-white" aria-label="Trwa ładowanie propozycji"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Przejdź do koszyka</button> : <Link href="/koszyk" onClick={onClose} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white hover:bg-[#34302d]"><ShoppingBag className="h-4 w-4" aria-hidden="true" /> Przejdź do koszyka <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
        </div>
      </section>
    </div>, document.body,
  );
}
