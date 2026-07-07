"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createExpenseAction } from "@/app/admin/expenses/actions";
import {
  expenseCategories,
  expenseCategoryLabels,
  expensePaymentMethodLabels,
  expensePaymentMethods,
  isExpenseCorrection,
  type ExpenseCategory,
} from "@/lib/expenses";
import { SanitizedNumberInput } from "@/components/admin/SanitizedNumberInput";

type ExpenseFormProps = {
  today: string;
};

export function ExpenseForm({ today }: ExpenseFormProps) {
  const [category, setCategory] = useState<ExpenseCategory>("goods");
  const isCorrection = isExpenseCorrection(category);

  return (
    <form action={createExpenseAction} className="grid gap-4">
      <div className="mb-1 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-[#1f1f1f]">
            Nowy koszt
          </h2>
          <p className="mt-1 text-sm text-[#6d675f]">
            Wpisuj kwoty brutto z dokumentu.
          </p>
        </div>
      </div>

      <label className="block text-sm font-semibold text-[#1f1f1f]">
        Data
        <input
          className="field-input mt-2 min-h-10 py-2"
          name="expenseDate"
          type="date"
          defaultValue={today}
          required
        />
      </label>

      <label className="block text-sm font-semibold text-[#1f1f1f]">
        Kategoria
        <select
          className="field-input mt-2 min-h-10 py-2"
          name="category"
          value={category}
          onChange={(event) => {
            setCategory(event.currentTarget.value as ExpenseCategory);
          }}
          required
        >
          {expenseCategories.map((categoryOption) => (
            <option key={categoryOption} value={categoryOption}>
              {expenseCategoryLabels[categoryOption]}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold text-[#1f1f1f]">
        Opis
        <input
          className="field-input mt-2 min-h-10 py-2"
          name="description"
          placeholder="np. opakowania kartonowe"
          required
        />
      </label>

      <label className="block text-sm font-semibold text-[#1f1f1f]">
        Kwota brutto
        <SanitizedNumberInput
          className="field-input mt-2 min-h-10 py-2"
          name="amount"
          numberMode="float"
          min="0.01"
          step="0.01"
          placeholder="0,00"
          required
        />
        {isCorrection ? (
          <span className="mt-2 block rounded-lg bg-[#eef8ed] px-3 py-2 text-xs font-semibold leading-5 text-[#2f6b3f]">
            Ta pozycja zostanie odjęta od sumy kosztów. Używaj tylko wtedy,
            gdy to sklep otrzymał zwrot pieniędzy od dostawcy lub operatora.
            Zwroty pieniędzy klientom rozliczaj w zamówieniach jako korektę
            przychodu.
          </span>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-[#1f1f1f]">
          Sprzedawca
          <input
            className="field-input mt-2 min-h-10 py-2"
            name="vendor"
            placeholder="np. OVH, hurtownia"
          />
        </label>
        <label className="block text-sm font-semibold text-[#1f1f1f]">
          Metoda płatności
          <select
            className="field-input mt-2 min-h-10 py-2"
            name="paymentMethod"
            defaultValue="other"
            required
          >
            {expensePaymentMethods.map((method) => (
              <option key={method} value={method}>
                {expensePaymentMethodLabels[method]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-[#1f1f1f]">
          Nr dokumentu
          <input
            className="field-input mt-2 min-h-10 py-2"
            name="documentNumber"
            placeholder="faktura/paragon"
          />
        </label>
      </div>

      <label className="block text-sm font-semibold text-[#1f1f1f]">
        Link do dokumentu
        <input
          className="field-input mt-2 min-h-10 py-2"
          name="documentUrl"
          type="url"
          placeholder="https://..."
        />
      </label>

      <label className="block text-sm font-semibold text-[#1f1f1f]">
        Uwagi
        <textarea
          className="field-input mt-2 min-h-20 resize-y"
          name="notes"
          placeholder="np. numer faktury, zakres zakupu, zwrot od dostawcy"
        />
      </label>

      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
      >
        Dodaj koszt
      </button>
    </form>
  );
}
