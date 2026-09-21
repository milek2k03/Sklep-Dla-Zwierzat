"use client";

import { Ban } from "lucide-react";
import { useFormStatus } from "react-dom";
import { revokeMarketingConsentAction } from "@/app/admin/marketing/actions";

export function MarketingRevokeForm({ email }: { email: string }) {
  return (
    <form
      action={revokeMarketingConsentAction}
      onSubmit={(event) => {
        if (!window.confirm(`Wyłączyć maile promocyjne dla ${email}?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="email" value={email} />
      <RevokeButton />
    </form>
  );
}

function RevokeButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#9c5a59] bg-[#482b2d] px-3 text-sm font-semibold text-[#ffe2df] transition hover:border-[#ed8984] hover:bg-[#5b3335] disabled:cursor-wait disabled:opacity-60"
    >
      <Ban className="h-4 w-4" aria-hidden="true" />
      {pending ? "Wyłączanie..." : "Wyłącz maile"}
    </button>
  );
}
