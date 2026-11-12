"use client";

import { useEffect } from "react";

/** 极小的滚动状态探针：往 <html> 挂 .is-scrolled，站头底线据此加深 */
export function HeaderScroll() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      root.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove("is-scrolled");
    };
  }, []);
  return null;
}
