"use client";

import { useId, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";

/**
 * 破坏性操作的二次确认：点击后弹出原生 <dialog>，
 * 确认按钮写明具体动作，Esc / 取消可退出。
 */
export function ConfirmButton({
  action,
  title,
  description,
  confirmLabel,
  children,
  className,
  "aria-label": ariaLabel,
  onDone,
}: {
  action: () => Promise<unknown>;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  onDone?: (error?: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    ref.current?.showModal();
  }

  function confirm() {
    start(async () => {
      try {
        await action();
        ref.current?.close();
        onDone?.();
      } catch (err) {
        const msg = err instanceof Error && err.message ? err.message : "操作失败，请刷新后重试";
        setError(msg);
        onDone?.(msg);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={open} aria-label={ariaLabel} className={className}>
        {children}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="admin-dialog"
        onClick={(e) => {
          // 点遮罩关闭
          if (e.target === e.currentTarget && !pending) e.currentTarget.close();
        }}
      >
        <div className="p-5 sm:p-6">
          <h2 id={titleId} className="text-[1rem] font-semibold text-ink">
            {title}
          </h2>
          {description && (
            <div id={descId} className="mt-2 text-[0.875rem] leading-relaxed text-muted">
              {description}
            </div>
          )}
          <p role="alert" className={cn("text-[0.8125rem] text-accent-ink", error ? "mt-3" : "sr-only")}>
            {error ?? ""}
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              className="btn btn-ghost h-11! sm:h-10!"
              onClick={() => ref.current?.close()}
              disabled={pending}
            >
              取消
            </button>
            <button type="button" className="btn btn-danger h-11! sm:h-10!" onClick={confirm} disabled={pending}>
              {pending ? "处理中…" : confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
