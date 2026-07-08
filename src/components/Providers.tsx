"use client";

import { Toaster } from "sonner";

export function Providers() {
  return (
    <Toaster
      closeButton
      richColors
      position="top-center"
      offset={{ top: "20px" }}
      mobileOffset={{
        top: "calc(env(safe-area-inset-top, 0px) + 92px)",
        left: "14px",
        right: "14px",
      }}
      toastOptions={{
        duration: 3200,
        classNames: {
          toast: "max-w-[calc(100vw-28px)]",
          closeButton:
            "!left-2 !top-2 !translate-x-0 !translate-y-0 sm:!-left-3 sm:!-top-3",
        },
        style: {
          borderRadius: "8px",
        },
      }}
    />
  );
}
