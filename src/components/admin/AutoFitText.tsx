"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type AutoFitTextProps = {
  children: ReactNode;
  className?: string;
  maxFontSize: number;
  minFontSize: number;
  title?: string;
};

export function AutoFitText({
  children,
  className,
  maxFontSize,
  minFontSize,
  title,
}: AutoFitTextProps) {
  const textRef = useRef<HTMLElement | null>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  const fitText = useCallback(() => {
    const element = textRef.current;

    if (!element || element.clientWidth <= 0) {
      return;
    }

    const previousTransition = element.style.transition;
    element.style.transition = "none";

    let low = minFontSize;
    let high = maxFontSize;
    let best = minFontSize;

    for (let step = 0; step < 9; step += 1) {
      const nextSize = (low + high) / 2;
      element.style.fontSize = `${nextSize}px`;

      if (element.scrollWidth <= element.clientWidth + 1) {
        best = nextSize;
        low = nextSize;
      } else {
        high = nextSize;
      }
    }

    element.style.transition = previousTransition;
    setFontSize(Math.floor(best));
  }, [maxFontSize, minFontSize]);

  useEffect(() => {
    const element = textRef.current;

    if (!element) {
      return;
    }

    let frameId: number | null = null;
    let isMounted = true;

    function scheduleFit() {
      if (!isMounted) {
        return;
      }

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(fitText);
    }

    scheduleFit();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleFit);
    observer?.observe(element);

    if (element.parentElement) {
      observer?.observe(element.parentElement);
    }

    void document.fonts?.ready.then(scheduleFit);

    return () => {
      isMounted = false;

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      observer?.disconnect();
    };
  }, [children, fitText]);

  return (
    <span
      ref={textRef}
      className={className}
      style={{
        display: "block",
        fontSize,
        maxWidth: "100%",
        minWidth: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
        width: "100%",
      }}
      title={title}
    >
      {children}
    </span>
  );
}
