"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { Database } from "@/types/supabase";

type ReturnCaseStatus =
  Database["public"]["Tables"]["return_cases"]["Row"]["status"];
type ReturnCaseType =
  Database["public"]["Tables"]["return_cases"]["Row"]["case_type"];
type RestockAction =
  Database["public"]["Tables"]["return_case_items"]["Row"]["restock_action"];

type ReturnCaseControlItem = {
  id: string;
  productName: string;
  restockAction: RestockAction;
  conditionNote: string | null;
};

const editableStatuses = [
  "reported",
  "awaiting_package",
  "package_received",
  "accepted",
  "rejected",
] as const satisfies readonly ReturnCaseStatus[];

const caseStatusLabels: Record<ReturnCaseStatus, string> = {
  reported: "Zgłoszone",
  awaiting_package: "Oczekuje na paczkę",
  package_received: "Paczka odebrana",
  accepted: "Zaakceptowane",
  rejected: "Odrzucone",
  closed: "Zamknięte",
};

export function ReturnCaseControls({
  adminNotes,
  caseId,
  caseType,
  closeAction,
  items,
  returnItemsTotal,
  status,
  updateAction,
}: {
  adminNotes: string | null;
  caseId: string;
  caseType: ReturnCaseType;
  closeAction: (formData: FormData) => Promise<void>;
  items: ReturnCaseControlItem[];
  returnItemsTotal: number;
  status: ReturnCaseStatus;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const [selectedStatus, setSelectedStatus] = useState<ReturnCaseStatus>(status);
  const [notes, setNotes] = useState(adminNotes ?? "");
  const [restockActions, setRestockActions] = useState<Record<string, RestockAction>>(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, item.restockAction]),
      ) as Record<string, RestockAction>,
  );
  const canClose = selectedStatus === "accepted" || selectedStatus === "rejected";
  const hasPendingStockDecision = useMemo(
    () => items.some((item) => restockActions[item.id] === "pending"),
    [items, restockActions],
  );
  const supportsMoneyRefund = caseType !== "exchange";
  const canRefund = supportsMoneyRefund && selectedStatus === "accepted";
  const closeDisabled = !canClose || hasPendingStockDecision;

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-2 lg:items-start">
      <form action={updateAction} className="grid gap-3">
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="status" value={selectedStatus} />
        <input type="hidden" name="adminNotes" value={notes} />

        <label className="block">
          <span className="text-sm font-semibold text-[#1f1f1f]">
            Status sprawy
          </span>
          <select
            className="field-input mt-2"
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value as ReturnCaseStatus)
            }
          >
            {editableStatuses.map((nextStatus) => (
              <option key={nextStatus} value={nextStatus}>
                {caseStatusLabels[nextStatus]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#1f1f1f]">
            Notatka admina
          </span>
          <textarea
            className="field-input mt-2 min-h-20 resize-y"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d7cab9] px-4 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]"
        >
          Zapisz status
        </button>
      </form>

      <form
        action={closeAction}
        className="grid gap-3 rounded-lg border border-[#eee7db] bg-[#fffdf8] p-4"
      >
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="status" value={selectedStatus} />
        <input type="hidden" name="adminNotes" value={notes} />
        <p className="text-sm font-semibold text-[#1f1f1f]">
          Zamknięcie sprawy
        </p>
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-[#eee7db] bg-white p-3">
            <p className="break-words text-sm font-semibold text-[#1f1f1f]">
              {item.productName}
            </p>
            <select
              name={`restockAction:${item.id}`}
              className="field-input mt-2 min-h-10 py-2"
              value={restockActions[item.id] ?? "pending"}
              onChange={(event) =>
                setRestockActions((currentActions) => ({
                  ...currentActions,
                  [item.id]: event.target.value as RestockAction,
                }))
              }
            >
              <option value="pending" disabled={canClose}>
                Nie decyduj teraz
              </option>
              <option value="restock">Wróć na magazyn</option>
              <option value="discard">Nie wraca na magazyn</option>
            </select>
            <input
              name={`conditionNote:${item.id}`}
              className="field-input mt-2 min-h-10 py-2"
              defaultValue={item.conditionNote ?? ""}
              placeholder="Stan produktu / uwagi"
            />
          </div>
        ))}

        {canRefund ? (
          <label className="block">
            <span className="text-sm font-semibold text-[#1f1f1f]">
              Zatwierdzona kwota zwrotu za produkty
            </span>
            <input
              name="approvedRefundAmount"
              className="field-input mt-2"
              type="number"
              inputMode="decimal"
              min="0"
              max={returnItemsTotal.toFixed(2)}
              step="0.01"
              defaultValue={returnItemsTotal.toFixed(2)}
              placeholder="0,00"
            />
            <span className="mt-1 block text-xs leading-5 text-[#7a746d]">
              Suma zwracanych produktów: {formatPrice(returnItemsTotal)}.
              Dostawa nie jest wliczana. Możesz wpisać mniej, np. przy
              częściowej reklamacji.
            </span>
          </label>
        ) : (
          <input type="hidden" name="approvedRefundAmount" value="0" />
        )}

        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#1f1f1f] px-4 text-sm font-semibold text-white transition hover:bg-[#34302d] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={closeDisabled}
        >
          Zamknij sprawę
        </button>
        {!canClose ? (
          <p className="text-xs leading-5 text-[#a64022]">
            Sprawę można zamknąć dopiero po wybraniu statusu Zaakceptowane albo
            Odrzucone.
          </p>
        ) : hasPendingStockDecision ? (
          <p className="text-xs leading-5 text-[#a64022]">
            Przed zamknięciem wybierz decyzję magazynową dla każdego produktu.
          </p>
        ) : (
          <p className="text-xs leading-5 text-[#7a746d]">
            Zamknięcie zapisze aktualny status i decyzje magazynowe.
          </p>
        )}
      </form>
    </div>
  );
}
