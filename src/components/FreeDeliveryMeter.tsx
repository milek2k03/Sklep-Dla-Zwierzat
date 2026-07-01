import { Truck } from "lucide-react";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/delivery";
import { formatPrice } from "@/lib/format";

type FreeDeliveryMeterProps = {
  subtotal: number;
};

export function FreeDeliveryMeter({ subtotal }: FreeDeliveryMeterProps) {
  const missing = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);
  const isUnlocked = missing === 0;

  return (
    <div className="rounded-lg border border-[#eee7db] bg-[#fffdf8] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f0ed] text-[#35594d]">
          <Truck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#1f1f1f]">
              {isUnlocked ? "Darmowa dostawa aktywna" : "Darmowa dostawa"}
            </p>
            <span className="shrink-0 text-xs font-semibold text-[#7a746d]">
              od {formatPrice(FREE_DELIVERY_THRESHOLD)}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eadfce]">
            <div
              className="h-full rounded-full bg-[#e86f2c] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-[#6d675f]">
            {isUnlocked
              ? "Dostawa dla tego koszyka jest po naszej stronie."
              : `Dodaj jeszcze za ${formatPrice(missing)}, aby odblokować darmową dostawę.`}
          </p>
        </div>
      </div>
    </div>
  );
}
