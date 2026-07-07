import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { storeBrandName } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Płatność przyjęta | ${storeBrandName}`,
};

type SuccessPageProps = {
  searchParams: Promise<{
    order?: string | string[];
  }>;
};

export default async function OrderSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const resolvedSearchParams = await searchParams;
  const orderNumber = normalizeOrderNumber(resolvedSearchParams.order);

  return (
    <section className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
      <CheckoutSteps activeStep="podsumowanie" />
      <div className="mt-8 rounded-lg border border-[#dbe9dc] bg-white px-5 py-12 shadow-sm sm:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f4ea] text-[#2f6b3f]">
          <Check className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-[#2f6b3f]">
          {orderNumber
            ? `Zamówienie ${orderNumber}`
            : `Zamówienie ${storeBrandName}`}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
          Płatność została przyjęta
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[#6d675f]">
          Status zamówienia zostanie automatycznie oznaczony jako opłacony po
          potwierdzeniu webhooka Stripe.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={
              orderNumber
                ? `/zamowienie/status?order=${encodeURIComponent(orderNumber)}`
                : "/zamowienie/status"
            }
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#1f1f1f] px-6 text-sm font-semibold text-white transition hover:bg-[#34302d]"
          >
            Sprawdź status
          </Link>
          <Link
            href="/produkty"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#ded2bf] bg-white px-6 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
          >
            Wróć do produktów
          </Link>
        </div>
      </div>
    </section>
  );
}

function normalizeOrderNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue?.trim().slice(0, 80) ?? "";
}
