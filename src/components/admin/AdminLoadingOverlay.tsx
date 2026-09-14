"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";

const START_EVENT = "pawly-admin-loading-start";
const STOP_EVENT = "pawly-admin-loading-stop";
const DEFAULT_LABEL = "Przetwarzanie...";
const NAVIGATION_LABEL = "Wczytywanie strony...";
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

    function handleLinkClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest("a[href]");

      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      if (!link.closest(".admin-theme") || link.dataset.adminLoading === "false") {
        return;
      }

      if (link.target && link.target !== "_self") {
        return;
      }

      if (link.hasAttribute("download")) {
        return;
      }

      const rawHref = link.getAttribute("href");

      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return;
      }

      const url = getInternalUrl(link.href);

      if (!url) {
        return;
      }

      if (url.pathname.startsWith("/api/") || url.pathname.includes("/export")) {
        return;
      }

      const currentPathAndSearch = `${window.location.pathname}${window.location.search}`;
      const nextPathAndSearch = `${url.pathname}${url.search}`;

      if (currentPathAndSearch === nextPathAndSearch) {
        return;
      }

      showLoading(link.dataset.loadingLabel ?? NAVIGATION_LABEL, DEFAULT_TIMEOUT_MS);
    }

    window.addEventListener(START_EVENT, handleStart);
    window.addEventListener(STOP_EVENT, hideLoading);
    document.addEventListener("click", handleLinkClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      window.removeEventListener(START_EVENT, handleStart);
      window.removeEventListener(STOP_EVENT, hideLoading);
      document.removeEventListener("click", handleLinkClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      clearLoadingTimeout(timeoutRef);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05070b]/76 px-4 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex min-w-[240px] flex-col items-center rounded-xl border border-white/12 bg-[#11151b]/94 px-7 py-6 text-center shadow-2xl shadow-black/40">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f4a261]/12">
          <Loader2 className="h-8 w-8 animate-spin text-[#f4a261]" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-xs text-[#98a2b3]">
          Poczekaj, operacja jest wykonywana.
        </p>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-full animate-pulse rounded-full bg-[#f4a261]" />
        </div>
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

function getInternalUrl(href: string) {
  try {
    const url = new URL(href, window.location.href);

    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
}
