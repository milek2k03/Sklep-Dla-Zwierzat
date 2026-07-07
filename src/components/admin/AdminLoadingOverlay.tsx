"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";

const START_EVENT = "pawly-admin-loading-start";
const STOP_EVENT = "pawly-admin-loading-stop";
const DEFAULT_LABEL = "Przetwarzanie...";
const DEFAULT_TIMEOUT_MS = 20000;
const EXPORT_TIMEOUT_MS = 3500;

type LoadingEventDetail = {
  label?: string;
  timeoutMs?: number;
};

export function startAdminLoading(
  label: string = DEFAULT_LABEL,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<LoadingEventDetail>(START_EVENT, {
      detail: { label, timeoutMs },
    }),
  );
}

export function stopAdminLoading() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(STOP_EVENT));
}

export function AdminLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isVisible, setIsVisible] = useState(false);
  const [label, setLabel] = useState(DEFAULT_LABEL);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      clearLoadingTimeout(timeoutRef);
      setIsVisible(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [routeKey]);

  useEffect(() => {
    function showLoading(nextLabel = DEFAULT_LABEL, timeoutMs = DEFAULT_TIMEOUT_MS) {
      clearLoadingTimeout(timeoutRef);
      setLabel(nextLabel);
      setIsVisible(true);

      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, timeoutMs);
    }

    function hideLoading() {
      clearLoadingTimeout(timeoutRef);
      setIsVisible(false);
    }

    function handleStart(event: Event) {
      const detail = (event as CustomEvent<LoadingEventDetail>).detail;
      showLoading(detail?.label ?? DEFAULT_LABEL, detail?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if (!form.closest(".admin-theme") || form.dataset.adminLoading === "false") {
        return;
      }

      const submitter =
        event.submitter instanceof HTMLElement ? event.submitter : null;
      const action = form.getAttribute("action") ?? "";
      const isExport = action.includes("/export");
      const nextLabel =
        submitter?.dataset.loadingLabel ??
        form.dataset.loadingLabel ??
        (isExport ? "Przygotowywanie pliku..." : DEFAULT_LABEL);

      showLoading(nextLabel, isExport ? EXPORT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
    }

    window.addEventListener(START_EVENT, handleStart);
    window.addEventListener(STOP_EVENT, hideLoading);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      window.removeEventListener(START_EVENT, handleStart);
      window.removeEventListener(STOP_EVENT, hideLoading);
      document.removeEventListener("submit", handleSubmit, true);
      clearLoadingTimeout(timeoutRef);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05070b]/62 px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex min-w-[220px] flex-col items-center rounded-xl border border-white/12 bg-[#11151b]/92 px-7 py-6 text-center shadow-2xl shadow-black/30">
        <Loader2 className="h-8 w-8 animate-spin text-[#f4a261]" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-xs text-[#98a2b3]">
          Poczekaj, operacja jest wykonywana.
        </p>
      </div>
    </div>
  );
}

function clearLoadingTimeout(
  ref: MutableRefObject<ReturnType<typeof setTimeout> | null>,
) {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}
