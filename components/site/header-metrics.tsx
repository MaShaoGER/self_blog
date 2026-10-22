"use client";

import { useLayoutEffect, useRef } from "react";

export function HeaderMetrics() {
  const marker = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const header = marker.current?.closest("header");
    if (!header) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--site-header-height");
    const measure = () => root.style.setProperty("--site-header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => {
      observer.disconnect();
      if (previous) root.style.setProperty("--site-header-height", previous);
      else root.style.removeProperty("--site-header-height");
    };
  }, []);
  return <span ref={marker} hidden />;
}
