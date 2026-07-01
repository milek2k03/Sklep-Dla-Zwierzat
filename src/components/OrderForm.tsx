"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Check,
  HandCoins,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { CheckoutTrust } from "@/components/CheckoutTrust";
import { FreeDeliveryMeter } from "@/components/FreeDeliveryMeter";
import {
  deliveryOptions,
  getDeliveryCost,
  getDeliveryOption,
} from "@/lib/delivery";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartHydrated, useCartStore } from "@/lib/cart-store";
import type { DeliveryMethod } from "@/types/cart";
import type { LocalOrder } from "@/types/order";

const orderSchema = z
  .object({
    fullName: z.string().min(3, "Podaj imię i nazwisko."),
    email: z.string().email("Podaj poprawny adres e-mail."),
    phone: z
      .string()
      .min(7, "Podaj numer telefonu.")
      .regex(/^[0-9+\-\s()]+$/, "Numer telefonu zawiera niedozwolone znaki."),
    deliveryMethod: z.enum([
      "inpost-paczkomat",
      "inpost-kurier",
      "dpd-kurier",
      "odbior-lokalny",
    ]),
    address: z.string().min(5, "Podaj adres dostawy lub odbioru."),
    pickupPoint: z.string().optional(),
    notes: z.string().optional(),
    termsAccepted: z
      .boolean()
      .refine((value) => value, "Zaakceptuj regulamin sklepu."),
  })
  .superRefine((data, context) => {
    if (
      data.deliveryMethod === "inpost-paczkomat" &&
      !data.pickupPoint?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["pickupPoint"],
        message: "Podaj numer paczkomatu.",
      });
    }
  });

type OrderFormValues = z.infer<typeof orderSchema>;

const defaultValues: OrderFormValues = {
  fullName: "",
  email: "",
  phone: "",
  deliveryMethod: "inpost-paczkomat",
  address: "",
  pickupPoint: "",
  notes: "",
  termsAccepted: false,
};

function readLocalOrders() {
  try {
    return JSON.parse(
      window.localStorage.getItem("pawly-orders") ?? "[]",
    ) as LocalOrder[];
  } catch {
    return [];
  }
}

function saveOrder(order: LocalOrder) {
  const existingOrders = readLocalOrders();

  window.localStorage.setItem(
    "pawly-orders",
    JSON.stringify([order, ...existingOrders].slice(0, 10)),
  );
  window.localStorage.setItem("pawly-last-order", JSON.stringify(order));
}

function createOrderId() {
  return `PAWLY-${Date.now().toString().slice(-6)}`;
}

function createOrderTimestamp() {
  return new Date().toISOString();
}

export function OrderForm() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const isHydrated = useCartHydrated();
  const [submittedOrder, setSubmittedOrder] = useState<LocalOrder | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues,
  });

  const deliveryMethod = (useWatch({
    control,
    name: "deliveryMethod",
  }) ?? "inpost-paczkomat") as DeliveryMethod;

  const subtotal = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0,
      ),
    [items],
  );
  const deliveryCost = getDeliveryCost(deliveryMethod, subtotal);
  const total = subtotal + deliveryCost;

  const onSubmit = async (values: OrderFormValues) => {
    if (items.length === 0) {
      toast.error("Koszyk jest pusty", {
        description: "Dodaj produkty przed złożeniem zamówienia.",
      });
      return;
    }

    const payload = {
      ...values,
      items: items.map((item) => ({
        slug: item.product.slug,
        quantity: item.quantity,
      })),
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as
      | { order?: LocalOrder; error?: string; message?: string }
      | null;

    if (response.ok && result?.order) {
      saveOrder(result.order);
      setSubmittedOrder(result.order);
      clearCart();
      reset(defaultValues);
      toast.success("Zamówienie zostało zapisane");
      return;
    }

    if (response.status === 503 && result?.error === "SUPABASE_NOT_CONFIGURED") {
      const localOrder = createLocalFallbackOrder(values);

      saveOrder(localOrder);
      setSubmittedOrder(localOrder);
      clearCart();
      reset(defaultValues);
      toast.warning("Tryb testowy", {
        description:
          "Supabase nie jest skonfigurowany, więc zamówienie zapisano lokalnie.",
      });
      return;
    }

    toast.error("Nie udało się złożyć zamówienia", {
      description:
        result?.message ?? "Spróbuj ponownie lub skontaktuj się ze sklepem.",
    });
  };

  function createLocalFallbackOrder(values: OrderFormValues): LocalOrder {
    return {
      id: createOrderId(),
      createdAt: createOrderTimestamp(),
      customer: {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        address: values.address,
        pickupPoint: values.pickupPoint?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      },
      deliveryMethod: values.deliveryMethod,
      deliveryCost,
      subtotal,
      total,
      items,
    };
  }

  if (!isHydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="h-72 animate-pulse rounded-lg bg-[#f3ede3]" />
      </div>
    );
  }

  if (submittedOrder) {
    const delivery = getDeliveryOption(submittedOrder.deliveryMethod);

    return (
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <CheckoutSteps activeStep="podsumowanie" />

        <div className="mt-8 overflow-hidden rounded-lg border border-[#dbe9dc] bg-white shadow-sm">
          <div className="bg-[#e8f4ea] px-5 py-6 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#2f6b3f] shadow-sm">
                  <Check className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-[#2f6b3f]">
                  Zamówienie {submittedOrder.id}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
                  Zamówienie zostało przyjęte
                </h1>
              </div>
              <div className="rounded-lg bg-white/76 p-4 text-sm text-[#35594d] shadow-sm">
                <p className="font-semibold">Następny krok</p>
                <p className="mt-1 leading-6">
                  Potwierdzimy zamówienie i przekażemy dane do płatności.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex items-start gap-3 rounded-lg bg-[#f7f1e8] p-4">
                <HandCoins
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#b65320]"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-[#5f5a52]">
                  Zamówienie zostało przyjęte. Na tym etapie płatność odbywa
                  się ręcznie: BLIK na telefon lub przelew bankowy. Po
                  potwierdzeniu zamówienia otrzymasz dane do płatności.
                </p>
              </div>

              <div className="mt-7 space-y-4">
                {submittedOrder.items.map((item) => (
                  <div
                    key={item.product.slug}
                    className="flex items-center justify-between gap-4 border-b border-[#eee7db] pb-4 text-sm last:border-b-0"
                  >
                    <div>
                      <p className="font-semibold text-[#1f1f1f]">
                        {item.product.name}
                      </p>
                      <p className="mt-1 text-[#7a746d]">
                        Ilość: {item.quantity}
                      </p>
                    </div>
                    <span className="font-semibold text-[#1f1f1f]">
                      {formatPrice(item.product.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="h-fit rounded-lg border border-[#eee7db] bg-[#fffdf8] p-5">
              <h2 className="text-lg font-semibold text-[#1f1f1f]">
                Podsumowanie
              </h2>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between text-[#6d675f]">
                  <span>Produkty</span>
                  <span>{formatPrice(submittedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#6d675f]">
                  <span>Dostawa: {delivery.name}</span>
                  <span>{formatPrice(submittedOrder.deliveryCost)}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-[#1f1f1f] px-4 py-3 text-base font-semibold text-white">
                  <span>Razem</span>
                  <span>{formatPrice(submittedOrder.total)}</span>
                </div>
              </div>

              <Link
                href="/produkty"
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#1f1f1f] px-6 text-sm font-semibold text-white transition hover:bg-[#34302d]"
              >
                Wróć do produktów
              </Link>
            </aside>
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <CheckoutSteps activeStep="dane" />
        <div className="mt-8 rounded-lg border border-[#eee7db] bg-white px-5 py-12 shadow-sm sm:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
            <ShoppingBag className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
            Nie masz jeszcze produktów w koszyku
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[#6d675f]">
            Formularz zamówienia pojawi się po dodaniu produktów do koszyka.
          </p>
          <Link
            href="/produkty"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#1f1f1f] px-6 text-sm font-semibold text-white transition hover:bg-[#34302d]"
          >
            Zobacz produkty
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <CheckoutSteps activeStep="dane" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="min-w-0">
          <div className="rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
              Zamówienie
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f] sm:text-4xl">
              Dane do zamówienia
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#6d675f]">
              Wypełnij dane, a my potwierdzimy szczegóły płatności ręcznej.
            </p>
          </div>

          <form
            className="mt-5 rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm sm:p-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <FormSection
              title="Kontakt"
              description="Na te dane wyślemy potwierdzenie i szczegóły płatności."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Imię i nazwisko" error={errors.fullName?.message}>
                  <input
                    {...register("fullName")}
                    className="field-input"
                    autoComplete="name"
                  />
                </Field>
                <Field label="E-mail" error={errors.email?.message}>
                  <input
                    {...register("email")}
                    className="field-input"
                    type="email"
                    autoComplete="email"
                  />
                </Field>
              </div>

              <Field label="Telefon" error={errors.phone?.message}>
                <input
                  {...register("phone")}
                  className="field-input"
                  autoComplete="tel"
                />
              </Field>
            </FormSection>

            <FormSection
              title="Dostawa"
              description="Wybierz sposób dostawy i uzupełnij dane adresowe."
            >
              <div>
                <span className="text-sm font-semibold text-[#1f1f1f]">
                  Metoda dostawy
                </span>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {deliveryOptions.map((option) => {
                    const finalCost = getDeliveryCost(option.id, subtotal);
                    const isSelected = deliveryMethod === option.id;

                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "cursor-pointer rounded-lg border p-4 transition",
                          isSelected
                            ? "border-[#1f1f1f] bg-[#fffdf8] shadow-sm"
                            : "border-[#eee7db] hover:border-[#d8ccbd]",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            {...register("deliveryMethod")}
                            type="radio"
                            value={option.id}
                            className="mt-1 accent-[#1f1f1f]"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[#1f1f1f]">
                              {option.name}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-[#7a746d]">
                              {option.description}
                            </span>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-[#1f1f1f]">
                            {formatPrice(finalCost)}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Field label="Adres dostawy" error={errors.address?.message}>
                <textarea
                  {...register("address")}
                  className="field-input min-h-24 resize-y"
                  autoComplete="street-address"
                />
              </Field>

              <Field
                label="Numer paczkomatu / punktu odbioru"
                error={errors.pickupPoint?.message}
              >
                <input {...register("pickupPoint")} className="field-input" />
              </Field>
            </FormSection>

            <FormSection
              title="Dodatkowe informacje"
              description="Dodaj uwagi do zamówienia, jeśli są potrzebne."
            >
              <Field label="Uwagi" error={errors.notes?.message}>
                <textarea
                  {...register("notes")}
                  className="field-input min-h-24 resize-y"
                />
              </Field>

              <div>
                <label className="flex items-start gap-3 rounded-lg bg-[#f7f1e8] p-4 text-sm text-[#5f5a52]">
                  <input
                    {...register("termsAccepted")}
                    type="checkbox"
                    className="mt-1 accent-[#1f1f1f]"
                  />
                  <span>
                    Akceptuję{" "}
                    <Link
                      href="/regulamin"
                      className="font-semibold text-[#1f1f1f] underline-offset-4 hover:underline"
                    >
                      regulamin
                    </Link>{" "}
                    sklepu Pawly.
                  </span>
                </label>
                {errors.termsAccepted?.message ? (
                  <p className="mt-2 text-sm font-medium text-[#a64022]">
                    {errors.termsAccepted.message}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#e86f2c] px-6 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(232,111,44,0.22)] transition hover:-translate-y-0.5 hover:bg-[#cf5f25] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Składanie zamówienia..." : "Złóż zamówienie"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </FormSection>
          </form>

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
                Twoje zamówienie
              </h2>
              <p className="mt-1 text-xs text-[#7a746d]">
                Koszyk zostanie wyczyszczony po złożeniu zamówienia.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <FreeDeliveryMeter subtotal={subtotal} />
          </div>

          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <div
                key={item.product.slug}
                className="flex justify-between gap-4 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#1f1f1f]">
                    {item.product.name}
                  </p>
                  <p className="mt-1 text-[#7a746d]">Ilość: {item.quantity}</p>
                </div>
                <span className="font-semibold text-[#1f1f1f]">
                  {formatPrice(item.product.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3 border-t border-[#eee7db] pt-5 text-sm">
            <div className="flex justify-between text-[#6d675f]">
              <span>Produkty</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#6d675f]">
              <span>Dostawa</span>
              <span>{formatPrice(deliveryCost)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-[#1f1f1f] px-4 py-3 text-base font-semibold text-white">
              <span>Razem</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[#eee7db] py-6 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#1f1f1f]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#7a746d]">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#1f1f1f]">{label}</span>
      <span className="mt-2 block">{children}</span>
      {error ? (
        <span className="mt-2 block text-sm font-medium text-[#a64022]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
