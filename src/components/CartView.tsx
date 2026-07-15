"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import { useMemo } from "react";
import { CartItem } from "@/components/CartItem";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { CheckoutTrust } from "@/components/CheckoutTrust";
import { FreeDeliveryMeter } from "@/components/FreeDeliveryMeter";
import { formatPrice } from "@/lib/format";
import {
  getCartItemsCount,
  useCartHydrated,
  useCartStore,
} from "@/lib/cart-store";

export function CartView() {
  const items = useCartStore((state) => state.items);
  const isHydrated = useCartHydrated();
  const itemCount = useMemo(() => getCartItemsCount(items), [items]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0,
      ),
    [items],
  );

  if (!isHydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="h-64 animate-pulse rounded-lg bg-[#f3ede3]" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <CheckoutSteps activeStep="koszyk" />
        <div className="mt-8 rounded-lg border border-[#eee7db] bg-white px-5 py-12 shadow-sm sm:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
            <ShoppingBag className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
            Koszyk czeka na pierwszy produkt
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[#6d675f]">
            Wybierz spacerowe bestsellery albo gotowy zestaw i wróć tutaj, aby
            przejść do zamówienia.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/produkty"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#34302d]"
            >
              Zobacz produkty
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/#bestsellery"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#d7cab9] bg-white px-6 text-sm font-semibold text-[#1f1f1f] transition hover:-translate-y-0.5 hover:border-[#1f1f1f]"
            >
              Bestsellery
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <CheckoutSteps activeStep="koszyk" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-6 rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
                  Koszyk
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f] sm:text-4xl">
                  Twoje produkty
                </h1>
                <p className="mt-3 text-sm leading-6 text-[#6d675f]">
                  {itemCount} {itemCount === 1 ? "produkt" : "produkty"} w
                  koszyku, gotowe do zamówienia.
                </p>
              </div>
              <Link
                href="/produkty"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d7cab9] px-5 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
              >
                Dodaj więcej
              </Link>
            </div>
          </div>

          <FreeDeliveryMeter subtotal={subtotal} />

          <div className="mt-5 rounded-lg border border-[#eee7db] bg-white px-4 shadow-sm sm:px-6">
            {items.map((item) => (
              <CartItem key={item.product.slug} item={item} />
            ))}
          </div>

          <div className="mt-5">
            <CheckoutTrust />
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
              <PackageCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">
                Podsumowanie
              </h2>
              <p className="mt-1 text-xs text-[#7a746d]">
                Metodę dostawy wybierzesz w danych zamówienia.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#eee7db] bg-[#fffdf8] p-4">
            <p className="text-sm font-semibold text-[#1f1f1f]">
              Następny krok: dane i dostawa
            </p>
            <p className="mt-2 text-sm leading-6 text-[#6d675f]">
              W kolejnym kroku wybierzesz kuriera i uzupełnisz adres dostawy.
            </p>
          </div>

          <div className="mt-6 space-y-3 border-t border-[#eee7db] pt-5 text-sm">
            <div className="flex justify-between text-[#6d675f]">
              <span>Produkty</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#6d675f]">
              <span>Dostawa</span>
              <span>wybierzesz dalej</span>
            </div>
            <div className="flex justify-between rounded-lg bg-[#1f1f1f] px-4 py-3 text-base font-semibold text-white">
              <span>Suma produktów</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-lg bg-[#f7f1e8] p-4">
            <BadgeCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-[#b65320]"
              aria-hidden="true"
            />
            <p className="text-xs leading-5 text-[#6d675f]">
              Wysyłka jest dostępna tylko na terenie Polski. Płatność odbywa
              się online po uzupełnieniu danych zamówienia.
            </p>
          </div>

          <Link
            href="/zamowienie"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#e86f2c] px-6 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(232,111,44,0.22)] transition hover:-translate-y-0.5 hover:bg-[#cf5f25]"
          >
            Przejdź do zamówienia
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </section>
  );
}
