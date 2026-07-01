import { HandCoins, RotateCcw, ShieldCheck } from "lucide-react";

const trustItems = [
  {
    icon: HandCoins,
    title: "Płatność ręczna",
    text: "BLIK lub przelew po potwierdzeniu.",
  },
  {
    icon: ShieldCheck,
    title: "Bezpieczny etap testowy",
    text: "Bez logowania i bez zewnętrznych płatności.",
  },
  {
    icon: RotateCcw,
    title: "14 dni na odstąpienie",
    text: "Regulamin zostanie dopracowany przed sprzedażą.",
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
