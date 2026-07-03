"use client";

import { Trash2 } from "lucide-react";

type DeleteProductButtonProps = {
  productName: string;
};

export function DeleteProductButton({ productName }: DeleteProductButtonProps) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        const confirmed = window.confirm(
          `Usunąć produkt "${productName}" z bazy danych? Tej akcji nie da się cofnąć.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#f0c7ba] px-3 text-sm font-semibold text-[#a64022] transition hover:border-[#a64022] hover:bg-[#fff1e8]"
      aria-label={`Usuń produkt ${productName}`}
      title="Usuń produkt"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
