"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 图片灯箱：正文图片点击后用原生 <dialog> 全屏查看。
 * 图片本体仍在正文里由 RSC 渲染，这里只承担交互与浮层。
 */
export function ImageLightbox({ src, alt }: { src: string; alt: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // 打开时锁 body 滚动，关闭/卸载时恢复
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const before = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = before;
    };
  }, [open]);

  function show() {
    const el = dialogRef.current;
    if (!el || el.open) return;
    el.showModal();
    setOpen(true);
  }

  function hide() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={alt ? `放大查看图片：${alt}` : "放大查看图片"}
        className="group relative my-[2em]! block w-full cursor-zoom-in border-0 bg-transparent p-0 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 正文图片，外框与留白交给按钮 */}
        <img src={src} alt={alt} loading="lazy" decoding="async" className="m-0!" />
        <span
          aria-hidden
          className="mono pointer-events-none absolute right-0 bottom-0 flex items-center gap-1.5 border border-line-ink bg-paper px-2 py-1 text-[0.5625rem] leading-none tracking-[0.18em] text-ink uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <span className="size-1 bg-accent" />
          放大 / ZOOM
        </span>
      </button>

      {mounted &&
        createPortal(
          <dialog
            ref={dialogRef}
            onClose={() => setOpen(false)}
            aria-label={alt ? `图片查看：${alt}` : "图片查看"}
            className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-[#e8e4da] backdrop:bg-[#0b0b0c]"
          >
            <div className="flex h-full w-full flex-col bg-[#0b0b0c]">
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[rgba(232,228,218,0.16)] px-4 py-2.5 sm:px-6">
                <span className="mono text-[0.625rem] tracking-[0.2em] text-[rgba(232,228,218,0.5)] uppercase">
                  预览 / VIEWER
                </span>
                <button
                  type="button"
                  onClick={hide}
                  autoFocus
                  className="mono flex h-9 cursor-pointer items-center gap-2 border border-[rgba(232,228,218,0.28)] px-3 text-[0.625rem] leading-none tracking-[0.18em] text-[#e8e4da] uppercase transition-colors hover:border-[#ff6a35] hover:text-[#ff6a35]"
                >
                  关闭
                  <span aria-hidden className="text-[rgba(232,228,218,0.45)]">
                    ESC
                  </span>
                </button>
              </div>

              {/* 点黑场关闭；点图片本身不关闭 */}
              <div
                className="flex min-h-0 flex-1 cursor-zoom-out items-center justify-center p-4 sm:p-8"
                onClick={(e) => {
                  if (e.target === e.currentTarget) hide();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 原图放大查看，不经过 optimizer */}
                <img
                  src={src}
                  alt={alt}
                  className="max-h-[88vh] max-w-[92vw] cursor-default border border-[rgba(232,228,218,0.3)] object-contain"
                />
              </div>

              <div className="shrink-0 border-t border-[rgba(232,228,218,0.16)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                <p className="mono flex items-start gap-3 text-[0.6875rem] leading-relaxed tracking-[0.04em] text-[#b9b4a8]">
                  <span className="shrink-0 text-[#ff6a35]">图注</span>
                  <span aria-hidden className="text-[rgba(232,228,218,0.3)]">
                    —
                  </span>
                  <span className="min-w-0 flex-1 break-words">{alt || "这张图没有替代文本"}</span>
                </p>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
