"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackConversionEvent } from "@/lib/conversion-client";

export function ConversionPageTracker() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    const pagePath = `${window.location.pathname}${window.location.search}`;

    if (previousPathRef.current === pagePath) {
      return;
    }

    previousPathRef.current = pagePath;
    trackConversionEvent({
      eventType: "page_view",
      pagePath,
      pageTitle: document.title,
      referrer: document.referrer,
    });
  }, [pathname]);

  return null;
}
