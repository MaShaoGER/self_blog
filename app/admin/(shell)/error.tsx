"use client";

import Link from "next/link";

/**
 * 后台错误边界：保留控制台语境，给出返回列表与重试两条路。
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[60rem] px-4 pb-16 md:px-10">
      <div className="flex items-baseline justify-between border-b border-line-strong pb-2.5 pt-10">
        <h1 className="text-[1.375rem] font-semibold text-ink">这一步没走完</h1>
        <span className="mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">
          {error.digest ? `ERR ${error.digest.slice(0, 8)}` : "ERR ————"}
        </span>
      </div>

      <p className="mt-4 max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted">
        写入或读取时出错了，改动可能没有保存。先重试；还不行就回列表确认当前状态。
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary h-10 px-4 text-sm">
          重试
        </button>
        <Link href="/admin/posts" className="btn btn-ghost h-10 px-4 text-sm">
          返回文章列表
        </Link>
      </div>
    </div>
  );
}
