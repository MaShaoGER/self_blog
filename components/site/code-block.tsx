"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * 代码块工具条：左侧语言铭牌 + 右侧复制键。
 * 只负责交互，代码本体与高亮 span 由 RSC 侧渲染后作为兄弟节点输出，
 * 因此这里不会重新解析或重新高亮。
 */

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 非安全上下文（局域网 http 访问）下 Clipboard API 不可用，回退到选中复制
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CodeToolbar({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    const ok = await copyText(code);
    // 失败静默：不弹提示、不改按钮状态
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mono flex min-h-10 select-none items-stretch justify-between border-b border-line-ink bg-surface-2">
      <span className="flex min-w-0 items-center gap-2 px-2.5">
        <span
          className="flex items-center gap-1.5 border border-line-ink bg-bg px-1.5 py-1 text-[0.5625rem] leading-none tracking-[0.2em] text-ink uppercase"
          title={`代码语言 / ${language}`}
        >
          <span aria-hidden className="size-1 shrink-0 bg-accent" />
          {language}
        </span>
      </span>

      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "代码已复制" : ""}
      </span>

      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? `已复制 ${language} 代码` : `复制 ${language} 代码`}
        className={cn(
          "flex shrink-0 cursor-pointer items-center gap-1.5 border-l border-line-ink px-3 text-[0.625rem] leading-none tracking-[0.16em] uppercase transition-colors",
          copied ? "bg-bg text-ink" : "text-muted hover:bg-bg hover:text-ink",
        )}
      >
        <span
          aria-hidden
          className={cn("led scale-50", copied ? "led-green opacity-100" : "opacity-25")}
        />
        {copied ? "已复制" : "复制"}
      </button>
    </div>
  );
}
