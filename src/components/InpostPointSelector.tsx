"use client";

import Script from "next/script";
import { MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const pointSelectionEventName = "pawlyInpostPointSelected";

export type SelectedInpostPoint = {
  name: string;
  displayName: string;
  addressLine1: string;
  addressLine2: string;
};

export function InpostPointSelector({
  onSelect,
  selectedPoint,
}: {
  onSelect: (point: SelectedInpostPoint) => void;
  selectedPoint: SelectedInpostPoint | null;
}) {
  const token = process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN?.trim();
  const baseUrl = (
    process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_URL ??
    "https://geowidget.inpost.pl"
  ).replace(/\/$/, "");
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isScriptReady, setIsScriptReady] = useState(false);

  useEffect(() => {
    if (!token || document.querySelector('link[data-pawly-inpost-widget="true"]')) {
      return;
    }

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = `${baseUrl}/inpost-geowidget.css`;
    stylesheet.dataset.pawlyInpostWidget = "true";
    document.head.append(stylesheet);
  }, [baseUrl, token]);

  useEffect(() => {
    if (!isOpen || !isScriptReady || !token || !widgetContainerRef.current) {
      return;
    }

    const widget = document.createElement("inpost-geowidget");
    widget.setAttribute("token", token);
    widget.setAttribute("language", "pl");
    widget.setAttribute("config", "parcelcollect");
    widget.setAttribute("onpoint", pointSelectionEventName);
    widget.style.display = "block";
    widget.style.width = "100%";
    widget.style.height = "min(68vh, 720px)";
    widgetContainerRef.current.replaceChildren(widget);

    const handlePointSelection = (event: Event) => {
      const customEvent = event as CustomEvent<Record<string, unknown>>;
      const eventWithDetails = event as Event & {
        details?: Record<string, unknown>;
      };
      const point = customEvent.detail ?? eventWithDetails.details;
      const selected = normalizeSelectedPoint(point);

      if (!selected) {
        return;
      }

      onSelect(selected);
      setIsOpen(false);
    };

    document.addEventListener(
      pointSelectionEventName,
      handlePointSelection as EventListener,
    );

    return () => {
      document.removeEventListener(
        pointSelectionEventName,
        handlePointSelection as EventListener,
      );
      widget.remove();
    };
  }, [isOpen, isScriptReady, onSelect, token]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!token) {
    return null;
  }

  return (
    <>
      <Script
        src={`${baseUrl}/inpost-geowidget.js`}
        strategy="afterInteractive"
        onLoad={() => setIsScriptReady(true)}
        onReady={() => setIsScriptReady(true)}
      />

      <div className="rounded-lg border border-[#e7dfd2] bg-[#fffdf8] p-4">
        {selectedPoint ? (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffdc00] text-[#1f1f1f]">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#1f1f1f]">
                {selectedPoint.displayName}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#6d675f]">
                {selectedPoint.addressLine1}
                {selectedPoint.addressLine2
                  ? `, ${selectedPoint.addressLine2}`
                  : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-6 text-[#6d675f]">
            Wybierz automat Paczkomat lub PaczkoPunkt na mapie InPost.
          </p>
        )}

        <button
          type="button"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:bg-[#34302d]"
          onClick={() => setIsOpen(true)}
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {selectedPoint ? "Zmień punkt odbioru" : "Wybierz punkt odbioru"}
        </button>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Wybierz punkt odbioru InPost"
        >
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-[#eee7db] px-4 py-3 sm:px-5">
              <div>
                <p className="font-semibold text-[#1f1f1f]">
                  Wybierz punkt odbioru InPost
                </p>
                <p className="mt-1 text-xs text-[#7a746d]">
                  Paczkomaty i PaczkoPunkty obsługujące odbiór przesyłek.
                </p>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e7dfd2] text-[#1f1f1f] transition hover:border-[#1f1f1f]"
                onClick={() => setIsOpen(false)}
                aria-label="Zamknij mapę punktów"
                title="Zamknij"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div
              ref={widgetContainerRef}
              className="min-h-[420px] flex-1 bg-[#f7f1e8]"
            >
              {!isScriptReady ? (
                <p className="p-6 text-sm text-[#6d675f]">
                  Ładowanie mapy InPost...
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function normalizeSelectedPoint(
  point: Record<string, unknown> | undefined,
): SelectedInpostPoint | null {
  if (!point || typeof point.name !== "string") {
    return null;
  }

  const address =
    point.address && typeof point.address === "object"
      ? (point.address as Record<string, unknown>)
      : {};

  return {
    name: point.name,
    displayName:
      typeof point.display_name === "string" ? point.display_name : point.name,
    addressLine1:
      typeof address.line1 === "string" ? address.line1 : "",
    addressLine2:
      typeof address.line2 === "string" ? address.line2 : "",
  };
}
