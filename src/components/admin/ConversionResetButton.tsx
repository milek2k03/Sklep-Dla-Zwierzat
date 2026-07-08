"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  startAdminLoading,
  stopAdminLoading,
} from "@/components/admin/AdminLoadingOverlay";

export function ConversionResetButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleReset() {
    const confirmed = window.confirm(
      "Usunąć wszystkie dane konwersji? Używaj tego tylko po testach.",
    );

    if (!confirmed) {
      return;
    }

    setIsPending(true);
    startAdminLoading("Czyszczenie danych konwersji...");

    try {
      const response = await fetch("/api/admin/conversion/reset", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("RESET_FAILED");
      }

      toast.success("Wyczyszczono dane konwersji");
      router.refresh();
    } catch {
      toast.error("Nie udało się wyczyścić danych konwersji");
    } finally {
      setIsPending(false);
      stopAdminLoading();
    }
  }

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={isPending}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#f3cbbd] px-5 text-sm font-semibold text-[#a64022] transition hover:border-[#a64022] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      Reset testów
    </button>
  );
}
