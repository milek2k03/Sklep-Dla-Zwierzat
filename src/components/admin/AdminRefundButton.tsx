"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  startAdminLoading,
  stopAdminLoading,
} from "@/components/admin/AdminLoadingOverlay";

export function AdminRefundButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const [isRefunding, setIsRefunding] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function refundOrder() {
    const confirmed = window.confirm(
      `Anulować zamówienie ${orderNumber}, zwrócić pełną płatność Stripe razem z dostawą i przywrócić magazyn?`,
    );

    if (!confirmed) {
      return;
    }

    setIsRefunding(true);
    startAdminLoading("Zlecanie zwrotu...");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Anulowanie zamówienia przez panel admina",
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        toast.error("Nie udało się wykonać zwrotu", {
          description: result?.message ?? "Sprawdź Stripe i spróbuj ponownie.",
        });
        return;
      }

      toast.success("Zwrot zlecony", {
        description: "Zamówienie anulowano, zwrócono płatność z dostawą i przywrócono magazyn.",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.error("Nie udało się wykonać zwrotu", {
        description: "Sprawdź połączenie i spróbuj ponownie.",
      });
    } finally {
      setIsRefunding(false);
      stopAdminLoading();
    }
  }

  return (
    <button
      type="button"
      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#f0b8a5] bg-[#fff6f1] px-4 text-sm font-semibold text-[#a64022] transition hover:border-[#a64022] hover:bg-[#fff1e8] focus:outline-none focus:ring-2 focus:ring-[#f0b8a5]/60 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={refundOrder}
      disabled={isRefunding || isPending}
    >
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      {isRefunding || isPending ? "Zwracanie..." : "Anuluj i zwróć płatność"}
    </button>
  );
}
