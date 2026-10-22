"use client";

import Link from "next/link";

/**
 * 根级错误边界：连 (site) 组布局都挂了时的最后一道。
 * 不带站头页脚，只留一个能离开的出口。
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="mx-auto flex min-h-dvh max-w-[44rem] flex-col justify-center gap-6 px-6 py-16">
          <p className="font-mono text-[0.6875rem] tracking-[0.14em] text-neutral-500 uppercase">
            FAULT / RUNTIME{error.digest ? ` · ${error.digest.slice(0, 8)}` : ""}
          </p>
          <h1 className="text-4xl font-extrabold tracking-[-0.02em]">站点暂时不可用</h1>
          <p className="max-w-[46ch] text-base leading-relaxed text-neutral-600">
            服务器在读档案时出错了。重试一次通常能恢复。
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={reset}
              className="border border-neutral-900 bg-neutral-900 px-5 py-3 text-sm text-neutral-50"
            >
              重新加载
            </button>
            <Link href="/" className="text-sm underline underline-offset-4">
              回到首页
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
