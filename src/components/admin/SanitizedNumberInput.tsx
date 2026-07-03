"use client";

import type { InputHTMLAttributes } from "react";

type SanitizedNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "onInput"
> & {
  numberMode: "float" | "int";
};

export function SanitizedNumberInput({
  numberMode,
  ...props
}: SanitizedNumberInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode={numberMode === "float" ? "decimal" : "numeric"}
      onInput={(event) => {
        event.currentTarget.value = sanitizeNumberValue(
          event.currentTarget.value,
          numberMode,
        );
      }}
    />
  );
}

function sanitizeNumberValue(value: string, mode: "float" | "int") {
  if (mode === "int") {
    return value.replace(/\D/g, "");
  }

  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [integerPart, ...decimalParts] = normalized.split(".");

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalParts.join("")}`;
}
