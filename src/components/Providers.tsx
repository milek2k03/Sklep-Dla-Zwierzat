"use client";

import { Toaster } from "sonner";

export function Providers() {
  return (
    <Toaster
      closeButton
      richColors
      position="top-center"
      toastOptions={{
        style: {
          borderRadius: "8px",
        },
      }}
    />
  );
}
