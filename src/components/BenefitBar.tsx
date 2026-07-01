import { Clock3, RotateCcw, ShieldCheck, Truck } from "lucide-react";

const benefits = [
  { icon: Truck, label: "Darmowa dostawa od 199 zł" },
  { icon: RotateCcw, label: "30 dni na zwrot" },
  { icon: ShieldCheck, label: "Bezpieczne zakupy" },
  { icon: Clock3, label: "Wysyłka 24h" },
];

export function BenefitBar() {
  return (
    <section className="border-y border-[#eee7db] bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 py-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;

          return (
            <div key={benefit.label} className="flex items-center gap-3 py-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-[#1f1f1f]">
                {benefit.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
