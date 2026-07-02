"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  orderStatusLabels,
  orderStatuses,
  type OrderStatus,
} from "@/lib/order-status";
import {
  getTrackingUrl,
  normalizeShippingCarrier,
  normalizeTrackingNumber,
  shippingCarrierOptions,
} from "@/lib/tracking";

export function AdminOrderStatusSelect({
  orderId,
  shippingCarrier,
  status,
  trackingNumber,
  trackingUrl,
}: {
  orderId: string;
  shippingCarrier: string | null;
  status: OrderStatus;
  trackingNumber: string | null;
  trackingUrl: string | null;
}) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [carrier, setCarrier] = useState(shippingCarrier ?? "");
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [trackingLink, setTrackingLink] = useState(trackingUrl ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const generatedTrackingLink = getTrackingUrl(carrier, tracking);
  const effectiveTrackingLink =
    trackingLink.trim() || generatedTrackingLink || "";

  const hasChanges =
    selectedStatus !== status ||
    normalizeShippingCarrier(carrier) !== (shippingCarrier ?? "") ||
    normalizeTrackingNumber(tracking) !== (trackingNumber ?? "") ||
    effectiveTrackingLink !== (trackingUrl ?? "");
  const isShipment = selectedStatus === "shipped";

  async function saveStatus() {
    if (!hasChanges) {
      return;
    }

    if (isShipment && (!carrier.trim() || !tracking.trim())) {
      toast.error("Uzupełnij dane wysyłki", {
        description: "Przewoźnik i numer śledzenia są wymagane.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: selectedStatus,
          shippingCarrier: carrier,
          trackingNumber: tracking,
          trackingUrl: effectiveTrackingLink,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        toast.error("Nie udało się zmienić statusu", {
          description: result?.message ?? "Odśwież stronę i spróbuj ponownie.",
        });
        return;
      }

      toast.success("Zamówienie zapisane");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.error("Nie udało się zmienić statusu", {
        description: "Sprawdź połączenie i spróbuj ponownie.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-w-64 rounded-lg border border-[#eee7db] bg-[#fffdf8] p-3 text-left">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#7a746d]">
          Status
        </span>
        <select
          className="mt-2 min-h-10 w-full rounded-lg border border-[#d7cab9] bg-white px-3 text-sm font-semibold text-[#1f1f1f] outline-none transition focus:border-[#1f1f1f] focus:shadow-[0_0_0_3px_rgba(232,111,44,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
          value={selectedStatus}
          onChange={(event) =>
            setSelectedStatus(event.target.value as OrderStatus)
          }
          disabled={isSaving || isPending}
        >
          {orderStatuses.map((orderStatus) => (
            <option key={orderStatus} value={orderStatus}>
              {orderStatusLabels[orderStatus]}
            </option>
          ))}
        </select>
      </label>

      {isShipment ? (
        <div className="mt-3 grid gap-2">
          <label className="block">
            <span className="text-xs font-semibold text-[#7a746d]">
              Przewoźnik
            </span>
            <select
              className="mt-1 min-h-10 w-full rounded-lg border border-[#d7cab9] bg-white px-3 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1f1f1f] focus:shadow-[0_0_0_3px_rgba(232,111,44,0.16)]"
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
            >
              <option value="">Wybierz przewoźnika</option>
              {shippingCarrierOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#7a746d]">
              Numer śledzenia
            </span>
            <input
              className="mt-1 min-h-10 w-full rounded-lg border border-[#d7cab9] bg-white px-3 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1f1f1f] focus:shadow-[0_0_0_3px_rgba(232,111,44,0.16)]"
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              placeholder="np. 1234567890"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#7a746d]">
              Link śledzenia
            </span>
            <input
              className="mt-1 min-h-10 w-full rounded-lg border border-[#d7cab9] bg-white px-3 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1f1f1f] focus:shadow-[0_0_0_3px_rgba(232,111,44,0.16)]"
              value={trackingLink}
              onChange={(event) => setTrackingLink(event.target.value)}
              placeholder={generatedTrackingLink ?? "https://..."}
            />
            {generatedTrackingLink ? (
              <span className="mt-1 block text-xs leading-5 text-[#7a746d]">
                Automatyczny link:{" "}
                <a
                  href={generatedTrackingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#1f1f1f] underline-offset-4 hover:underline"
                >
                  otwórz
                </a>
              </span>
            ) : null}
          </label>
        </div>
      ) : null}

      <button
        type="button"
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[#1f1f1f] px-4 text-sm font-semibold text-white transition hover:bg-[#34302d] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={saveStatus}
        disabled={!hasChanges || isSaving || isPending}
      >
        {isSaving || isPending ? "Zapisywanie..." : "Zapisz"}
      </button>
    </div>
  );
}
