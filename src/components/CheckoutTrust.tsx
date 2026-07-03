import { HandCoins, RotateCcw, ShieldCheck } from "lucide-react";

const trustItems = [
  {
    icon: HandCoins,
    title: "Płatność online",
    text: "Bezpieczna płatność obsługiwana przez Stripe.",
  },
  {
    icon: ShieldCheck,
    title: "Status zamówienia",
    text: "Sprawdzisz płatność, wysyłkę i tracking po numerze zamówienia.",
  },
  {
    icon: RotateCcw,
    title: "14 dni na zwrot",
    text: "Zwroty, reklamacje i wymiany zgłosisz przez status zamówienia.",
  },
];

export function CheckoutTrust() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {trustItems.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.title}
            className="rounded-lg border border-[#eee7db] bg-white p-4 shadow-sm"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-[#1f1f1f]">
              {item.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#7a746d]">{item.text}</p>
          </div>
        );
      })}
    </div>
  );
}
