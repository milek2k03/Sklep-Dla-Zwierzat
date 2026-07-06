"use client";

import { Download, PackagePlus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function AdminInpostShipmentPanel({
  configured,
  error,
  labelAvailable,
  orderId,
  service,
  shipmentId,
  shipmentStatus,
  trackingNumber,
}: {
  configured: boolean;
  error: string | null;
  labelAvailable: boolean;
  orderId: string;
  service: string | null;
  shipmentId: string | null;
  shipmentStatus: string | null;
  trackingNumber: string | null;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function createOrRefreshShipment() {
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/inpost/shipment`,
        {
          method: "POST",
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        toast.error("Nie udało się obsłużyć przesyłki InPost", {
          description: result?.message ?? "Spróbuj ponownie za chwilę.",
        });
        return;
      }

      toast.success(
        shipmentId
          ? "Status przesyłki InPost został odświeżony"
          : "Przesyłka InPost została utworzona",
      );
      startTransition(() => router.refresh());
    } catch {
      toast.error("Nie udało się połączyć z InPost");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[#f0d51b] bg-[#fffbea] p-3 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1f1f1f]">
            Przesyłka InPost
          </p>
          <p className="mt-1 text-xs leading-5 text-[#6d675f]">
            {shipmentId
              ? `ID ShipX: ${shipmentId}`
              : "Przesyłka zostanie utworzona po potwierdzeniu płatności."}
          </p>
        </div>
        {shipmentStatus ? (
          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-[#5f5a52]">
            {getInpostStatusLabel(shipmentStatus)}
          </span>
        ) : null}
      </div>

      {service ? (
        <p className="mt-2 text-xs text-[#6d675f]">Usługa: {service}</p>
      ) : null}
      {trackingNumber ? (
        <p className="mt-1 text-xs text-[#6d675f]">
          Tracking: <span className="font-semibold">{trackingNumber}</span>
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-lg bg-[#fff1e8] px-3 py-2 text-xs leading-5 text-[#a64022]">
          {error}
        </p>
      ) : null}
      {!configured ? (
        <p className="mt-2 text-xs leading-5 text-[#a64022]">
          Ustaw INPOST_SHIPX_TOKEN i INPOST_ORGANIZATION_ID w Vercel.
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d7cab9] bg-white px-3 text-xs font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={createOrRefreshShipment}
          disabled={!configured || isSaving || isPending}
        >
          {shipmentId ? (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PackagePlus className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving || isPending
            ? "Łączenie..."
            : shipmentId
              ? "Odśwież"
              : error
                ? "Ponów"
                : "Utwórz"}
        </button>
        <a
          href={
            labelAvailable
              ? `/api/admin/orders/${orderId}/inpost/label`
              : undefined
          }
          className={[
            "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold transition",
            labelAvailable
              ? "bg-[#1f1f1f] text-white hover:bg-[#34302d]"
              : "pointer-events-none bg-[#ded8ce] text-[#8a8177]",
          ].join(" ")}
          aria-disabled={!labelAvailable}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Pobierz etykietę
        </a>
      </div>
      {!labelAvailable && shipmentId ? (
        <p className="mt-2 text-xs leading-5 text-[#7a746d]">
          Etykieta będzie dostępna, gdy InPost potwierdzi przesyłkę.
        </p>
      ) : null}
    </div>
  );
}

function getInpostStatusLabel(status: string) {
  const labels: Record<string, string> = {
    creating: "Tworzenie",
    created: "Utworzona",
    offers_prepared: "Oferta gotowa",
    offer_selected: "Oferta wybrana",
    confirmed: "Potwierdzona",
    dispatched_by_sender: "Nadana",
    collected_from_sender: "Odebrana",
    delivered: "Doręczona",
    error: "Błąd",
  };

  return labels[status] ?? status;
}
