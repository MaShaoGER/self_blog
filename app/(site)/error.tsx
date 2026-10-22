"use client";

import { useEffect } from "react";

/**
 * 前台运行时错误：给访客一个可恢复的出口，而不是默认的错误堆栈。
 * 放在 (site) 组内，站头与页脚仍然保留。
 */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="sheet">
      <div className="wrap py-14 lg:py-20">
        <div className="mono flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line-ink pb-2 text-[0.6875rem] tracking-[0.14em] uppercase">
          <span className="flex items-baseline gap-3">
            <span className="text-signal">FAULT</span>
            <span aria-hidden className="text-faint">
              /
            </span>
            <span className="text-muted">RUNTIME</span>
          </span>
          <span className="text-faint tabular-nums">
            {error.digest ? `CODE ${error.digest.slice(0, 8)}` : "CODE ————"}
          </span>
        </div>

        <h1 className="display mt-6 text-[clamp(2rem,6vw,3.5rem)] leading-[0.98]">这台机器卡住了</h1>

        <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-ink-soft">
          页面没有读完就中断了。可以先重试；如果反复出现，稍后再来。
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button type="button" onClick={reset} className="keybtn keybtn-safety">
            <span>重新读取</span>
            <span aria-hidden>↻</span>
          </button>
          <a
            href="/"
            className="mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-ink hover:decoration-accent"
          >
            回到首页
          </a>
        </div>
      </div>
    </div>
  );
}
