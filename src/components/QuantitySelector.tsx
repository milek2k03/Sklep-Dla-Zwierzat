"use client";

import { Minus, Plus } from "lucide-react";

type QuantitySelectorProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
}: QuantitySelectorProps) {
  const currentValue = Math.min(Math.max(value, min), max);

  return (
    <div className="inline-flex h-12 items-center rounded-full border border-[#e7dfd2] bg-white">
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full text-[#1f1f1f] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => onChange(Math.max(min, currentValue - 1))}
        disabled={currentValue <= min}
        aria-label="Zmniejsz ilość"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="w-9 text-center text-sm font-semibold text-[#1f1f1f]">
        {currentValue}
      </span>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full text-[#1f1f1f] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => onChange(Math.min(max, currentValue + 1))}
        disabled={currentValue >= max}
        aria-label="Zwiększ ilość"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
