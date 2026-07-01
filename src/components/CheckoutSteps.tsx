import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { id: "koszyk", label: "Koszyk" },
  { id: "dane", label: "Dane" },
  { id: "podsumowanie", label: "Podsumowanie" },
] as const;

type CheckoutStepId = (typeof steps)[number]["id"];

type CheckoutStepsProps = {
  activeStep: CheckoutStepId;
};

export function CheckoutSteps({ activeStep }: CheckoutStepsProps) {
  const activeIndex = steps.findIndex((step) => step.id === activeStep);

  return (
    <div className="rounded-lg border border-[#eee7db] bg-white p-3 shadow-sm">
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;

          return (
            <li
              key={step.id}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition sm:text-sm",
                isActive && "bg-[#1f1f1f] text-white",
                isDone && "bg-[#e8f4ea] text-[#2f6b3f]",
                !isActive && !isDone && "bg-[#f7f1e8] text-[#7a746d]",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]",
                  isActive && "bg-white text-[#1f1f1f]",
                  isDone && "bg-[#2f6b3f] text-white",
                  !isActive && !isDone && "bg-white text-[#7a746d]",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
