"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import {
  getReturnCondition,
  getReturnConditionLabel,
  returnConditions,
  type ReturnCondition,
} from "@/lib/return-conditions";
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
  returnCondition: ReturnCondition | null;
  disposalReason: string | null;
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
  orderDeliveryCost,
  returnItemsTotal,
  status,
  updateAction,
}: {
  adminNotes: string | null;
  caseId: string;
  caseType: ReturnCaseType;
  closeAction: (formData: FormData) => Promise<void>;
  items: ReturnCaseControlItem[];
  orderDeliveryCost: number;
  returnItemsTotal: number;
  status: ReturnCaseStatus;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const [selectedStatus, setSelectedStatus] = useState<ReturnCaseStatus>(status);
  const [notes, setNotes] = useState(adminNotes ?? "");
  const [returnConditionByItem, setReturnConditionByItem] = useState<
    Record<string, ReturnCondition>
  >(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, getReturnCondition(item)]),
      ) as Record<string, ReturnCondition>,
  );
  const [disposalReasons, setDisposalReasons] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        items.map((item) => [
          item.id,
          item.disposalReason ?? item.conditionNote ?? "",
        ]),
      ) as Record<string, string>,
  );
  const canClose = selectedStatus === "accepted" || selectedStatus === "rejected";
  const hasPendingStockDecision = useMemo(
    () => items.some((item) => returnConditionByItem[item.id] === "needs_review"),
    [items, returnConditionByItem],
  );
  const hasMissingDisposalReason = useMemo(
    () =>
      items.some(
        (item) =>
          returnConditionByItem[item.id] === "unsellable" &&
          (disposalReasons[item.id] ?? "").trim().length === 0,
      ),
    [disposalReasons, items, returnConditionByItem],
  );
  const supportsMoneyRefund = caseType !== "exchange";
  const canRefund = supportsMoneyRefund && selectedStatus === "accepted";
  const canRefundDelivery = canRefund && orderDeliveryCost > 0;
  const closeDisabled =
    !canClose || hasPendingStockDecision || hasMissingDisposalReason;

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
              name={`returnCondition:${item.id}`}
              className="field-input mt-2 min-h-10 py-2"
              value={returnConditionByItem[item.id] ?? "needs_review"}
              onChange={(event) =>
                setReturnConditionByItem((currentConditions) => ({
                  ...currentConditions,
                  [item.id]: event.target.value as ReturnCondition,
                }))
              }
            >
              {returnConditions.map((condition) => (
                <option
                  disabled={condition === "needs_review" && canClose}
                  key={condition}
                  value={condition}
                >
                  {getReturnConditionLabel(condition)}
                </option>
              ))}
            </select>
            {returnConditionByItem[item.id] === "unsellable" ? (
              <label className="mt-2 block">
                <span className="text-xs font-semibold text-[#6d675f]">
                  Powód niewrócenia na magazyn
                </span>
                <input
                  name={`disposalReason:${item.id}`}
                  className="field-input mt-1 min-h-10 py-2"
                  placeholder="np. zabrudzony, uszkodzony, pogryziony, brak opakowania"
                  value={disposalReasons[item.id] ?? ""}
                  onChange={(event) =>
                    setDisposalReasons((currentReasons) => ({
                      ...currentReasons,
                      [item.id]: event.target.value,
                    }))
                  }
                />
              </label>
            ) : null}
          </div>
        ))}

        {canRefund ? (
          <label className="block">
            <span className="text-sm font-semibold text-[#1f1f1f]">
              Zatwierdzona kwota zwrotu za produkty
            </span>
            <input
              name="approvedProductRefundAmount"
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
              Możesz wpisać mniej, np. przy częściowej reklamacji.
            </span>
          </label>
        ) : (
          <input type="hidden" name="approvedProductRefundAmount" value="0" />
        )}

        {canRefundDelivery ? (
          <label className="block">
            <span className="text-sm font-semibold text-[#1f1f1f]">
              Zwrot kosztu dostawy
            </span>
            <input
              name="approvedDeliveryRefundAmount"
              className="field-input mt-2"
              type="number"
              inputMode="decimal"
              min="0"
              max={orderDeliveryCost.toFixed(2)}
              step="0.01"
              defaultValue="0"
              placeholder="0,00"
            />
            <span className="mt-1 block text-xs leading-5 text-[#7a746d]">
              Maksymalnie pobrana dostawa: {formatPrice(orderDeliveryCost)}.
              Przy pełnym odstąpieniu zwykle zwracasz dostawę do wysokości
              najtańszej dostępnej opcji.
            </span>
          </label>
        ) : (
          <input type="hidden" name="approvedDeliveryRefundAmount" value="0" />
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
        ) : hasMissingDisposalReason ? (
          <p className="text-xs leading-5 text-[#a64022]">
            Dla produktów niewracających na magazyn wpisz powód.
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
