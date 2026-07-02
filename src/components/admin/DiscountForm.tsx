"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import {
  discountScopeLabels,
  discountTimeModeLabels,
  weekdayLabels,
  type DiscountCodeRow,
  type DiscountScopeType,
  type DiscountTimeMode,
} from "@/lib/discounts";
import type { Product } from "@/types/product";

export function DiscountForm({
  action,
  discount,
  categories,
  products,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  discount?: DiscountCodeRow;
  categories: Array<"Wszystkie" | string>;
  products: Product[];
  submitLabel: string;
}) {
  const [scopeType, setScopeType] = useState<DiscountScopeType>(
    discount?.scope_type ?? "all",
  );
  const [timeMode, setTimeMode] = useState<DiscountTimeMode>(
    discount?.time_mode ?? "permanent",
  );

  return (
    <form action={action} className="grid gap-4">
      {discount ? <input type="hidden" name="id" value={discount.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
        <Field label="Kod rabatowy">
          <input
            name="code"
            className="field-input uppercase"
            defaultValue={discount?.code ?? ""}
            placeholder="WEEKSAVE"
            required
          />
        </Field>
        <Field label="Rabat (%)">
          <input
            name="percent"
            type="number"
            className="field-input"
            defaultValue={discount?.percent ?? 10}
            inputMode="numeric"
            min={0}
            max={100}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zakres">
          <select
            name="scopeType"
            className="field-input"
            value={scopeType}
            onChange={(event) =>
              setScopeType(event.target.value as DiscountScopeType)
            }
          >
            {(["all", "category", "product"] as DiscountScopeType[]).map(
              (nextScopeType) => (
                <option key={nextScopeType} value={nextScopeType}>
                  {discountScopeLabels[nextScopeType]}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label="Rodzaj kodu">
          <select
            name="timeMode"
            className="field-input"
            value={timeMode}
            onChange={(event) =>
              setTimeMode(event.target.value as DiscountTimeMode)
            }
          >
            {(["permanent", "scheduled", "recurring"] as DiscountTimeMode[]).map(
              (nextTimeMode) => (
                <option key={nextTimeMode} value={nextTimeMode}>
                  {discountTimeModeLabels[nextTimeMode]}
                </option>
              ),
            )}
          </select>
        </Field>
      </div>

      {scopeType === "category" ? (
        <Field label="Kolekcja objęta rabatem">
          <select
            name="scopeCategory"
            className="field-input"
            defaultValue={
              discount?.scope_type === "category" ? discount.scope_value ?? "" : ""
            }
            required
          >
            <option value="">Wybierz kolekcję</option>
            {categories
              .filter((category) => category !== "Wszystkie")
              .map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
          </select>
        </Field>
      ) : null}

      {scopeType === "product" ? (
        <Field label="Produkt objęty rabatem">
          <select
            name="scopeProduct"
            className="field-input"
            defaultValue={
              discount?.scope_type === "product" ? discount.scope_value ?? "" : ""
            }
            required
          >
            <option value="">Wybierz produkt</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {timeMode === "scheduled" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start">
            <input
              name="startsAt"
              type="datetime-local"
              className="field-input"
              defaultValue={toDateTimeLocal(discount?.starts_at)}
              required
            />
          </Field>
          <Field label="Koniec">
            <input
              name="endsAt"
              type="datetime-local"
              className="field-input"
              defaultValue={toDateTimeLocal(discount?.ends_at)}
              required
            />
          </Field>
        </div>
      ) : null}

      {timeMode === "recurring" ? (
        <fieldset className="rounded-lg bg-[#f7f1e8] p-4">
          <legend className="text-sm font-semibold text-[#1f1f1f]">
            Dni tygodnia objęte rabatem
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {weekdayLabels.map((weekday) => (
              <label
                key={weekday.value}
                className="flex items-center gap-2 rounded-lg border border-[#d7cab9] bg-white px-3 py-2 text-sm font-semibold text-[#1f1f1f]"
              >
                <input
                  name="weekdays"
                  type="checkbox"
                  value={weekday.value}
                  defaultChecked={discount?.weekdays.includes(weekday.value)}
                  className="accent-[#1f1f1f]"
                />
                {weekday.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="flex items-center gap-3 rounded-lg bg-[#f7f1e8] px-4 py-3 text-sm font-semibold text-[#1f1f1f]">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={discount?.is_active ?? true}
          className="accent-[#1f1f1f]"
        />
        Aktywny
      </label>

      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#1f1f1f]">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 16);
}
