"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Mode = "light" | "dark";

function apply(mode: Mode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  try {
    localStorage.setItem("theme", mode);
  } catch {}
}

/**
 * 主题拨杆（写实控件 1/5）：轨道凹槽 + 橡胶手柄，两态。
 * 原生 button + aria-pressed，键盘可操作；reduced-motion 下只保留颜色变化。
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem("theme") as Mode | null;
      } catch {
        return null;
      }
    })();
    const initial: Mode =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setMode(initial);
  }, []);

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-pressed={isDark}
      aria-label={isDark ? "切换到浅色主题" : "切换到深色主题"}
      title={isDark ? "LGT / DRK" : "LGT / DRK"}
      onClick={() => {
        const next: Mode = isDark ? "light" : "dark";
        setMode(next);
        apply(next);
      }}
      className={cn("lever group shrink-0", className)}
    >
      <span className="sr-only">{isDark ? "DRK" : "LGT"}</span>
      <span
        aria-hidden
        className="mono relative z-[1] flex w-1/2 justify-center text-[0.625rem] tracking-[0.12em] text-[#4a463d] uppercase"
      >
        LGT
      </span>
      <span
        aria-hidden
        className="mono relative z-[1] flex w-1/2 justify-center text-[0.625rem] tracking-[0.12em] text-[#8b8578] uppercase"
      >
        DRK
      </span>
    </button>
  );
}
