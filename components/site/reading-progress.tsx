"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const clampPct = (n: number) => Math.min(100, Math.max(0, n));

/**
 * 阅读进度：1px 凹槽 + 橙色进度段 + 右侧 mono 读数。
 * 读数取当前页面的滚动比例，scroll 用 requestAnimationFrame 节流；
 * reduced-motion 下取消宽度过渡，读数与进度照常更新。
 */
export function ReadingProgress({ className }: { className?: string }) {
  const [pct, setPct] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = -1;

    const measure = () => {
      frame = 0;
      const doc = document.documentElement;
      const span = doc.scrollHeight - window.innerHeight;
      const next = span > 1 ? Math.round(clampPct((window.scrollY / span) * 100)) : 100;
      if (next === last) return;
      last = next;
      setPct(next);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const value = clampPct(pct);
  const transition = reduce ? "none" : "width 120ms linear, left 120ms linear";

  return (
    <div
      role="progressbar"
      aria-label="阅读进度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={`已读 ${value}%`}
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}
    >
      <span
        aria-hidden
        className="mono hidden shrink-0 text-[0.625rem] leading-none tracking-[0.18em] text-faint uppercase xl:inline"
      >
        READ
      </span>

      {/* 1px 凹槽 + 橙色进度段 + 前端游标。栏宽不足时读数折到下一行，不挤压刻度 */}
      <span aria-hidden className="relative h-px min-w-[1.5rem] flex-1 bg-line-strong">
        <span className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${value}%`, transition }} />
        <span
          className="absolute -top-[3px] h-[7px] w-[2px] bg-accent"
          style={{ left: `clamp(0px, calc(${value}% - 2px), calc(100% - 2px))`, transition }}
        />
      </span>

      <span
        aria-hidden
        className="mono ml-auto w-8 shrink-0 text-right text-[0.6875rem] leading-none tracking-[0.06em] text-ink tabular-nums"
      >
        {value}%
      </span>
    </div>
  );
}
