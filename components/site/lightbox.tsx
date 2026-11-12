"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** 从 tokens.css 读时长/缓动，保证与全站动效约定一致。 */
function motionVar(name: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

function motionMs(name: string, fallback: number): number {
  const n = Number.parseFloat(motionVar(name, `${fallback}ms`));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * 图片灯箱：正文图片点击后用原生 <dialog> 全屏查看。
 * 图片本体仍在正文里由 RSC 渲染，这里只承担交互与浮层。
 * 打开/关闭时用 FLIP（量起止矩形 + transform）从缩略图原位放大、缩回。
 */
export function ImageLightbox({ src, alt }: { src: string; alt: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLImageElement>(null);
  const anims = useRef<Animation[]>([]);
  const busy = useRef(false);
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

  function clearAnims() {
    for (const a of anims.current) a.cancel();
    anims.current = [];
  }

  function show() {
    const el = dialogRef.current;
    if (!el || el.open || busy.current) return;
    clearAnims();
    el.showModal();
    setOpen(true);

    const img = figureRef.current;
    const thumb = thumbRef.current;
    const shell = shellRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !img || !thumb || !shell) return;

    // 原图未解码时矩形为 0：等 load 再量，避免动画从错误位置开始
    const zoom = () => {
      if (!el.open) return;
      const from = thumb.getBoundingClientRect();
      const to = img.getBoundingClientRect();
      if (from.width < 1 || from.height < 1 || to.width < 1 || to.height < 1) return;

      const sx = from.width / to.width;
      const sy = from.height / to.height;
      const tx = from.left + from.width / 2 - (to.left + to.width / 2);
      const ty = from.top + from.height / 2 - (to.top + to.height / 2);
      const duration = motionMs("--dur-3", 420);

      img.style.transformOrigin = "center";
      anims.current = [
        img.animate(
          [
            { transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})` },
            { transform: "translate(0px, 0px) scale(1, 1)" },
          ],
          { duration, easing: motionVar("--ease-out", "cubic-bezier(0.2, 0.7, 0.2, 1)") },
        ),
        shell.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: "ease-out" }),
      ];
    };

    if (img.complete && img.naturalWidth > 0) zoom();
    else img.addEventListener("load", zoom, { once: true });
  }

  async function hide() {
    const el = dialogRef.current;
    if (!el || !el.open || busy.current) return;
    busy.current = true;
    clearAnims();

    const img = figureRef.current;
    const thumb = thumbRef.current;
    const shell = shellRef.current;

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && img && thumb && shell) {
      const from = img.getBoundingClientRect();
      const to = thumb.getBoundingClientRect();
      if (from.width > 1 && from.height > 1 && to.width > 1 && to.height > 1) {
        const sx = to.width / from.width;
        const sy = to.height / from.height;
        const tx = to.left + to.width / 2 - (from.left + from.width / 2);
        const ty = to.top + to.height / 2 - (from.top + from.height / 2);
        const duration = motionMs("--dur-3", 420);
        const shrink = img.animate(
          [
            { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1 },
            { offset: 0.7, opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`, opacity: 0 },
          ],
          {
            duration,
            easing: motionVar("--ease-out", "cubic-bezier(0.2, 0.7, 0.2, 1)"),
            fill: "forwards",
          },
        );
        const mask = shell.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration,
          easing: "ease-out",
          fill: "forwards",
        });
        anims.current = [shrink, mask];
        await Promise.all([shrink.finished.catch(() => {}), mask.finished.catch(() => {})]);
      }
    }

    clearAnims();
    el.close();
    busy.current = false;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        aria-label={alt ? `放大查看图片：${alt}` : "放大查看图片"}
        className="group relative my-[2em]! block w-full cursor-zoom-in border-0 bg-transparent p-0 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 正文图片，外框与留白交给按钮 */}
        <img ref={thumbRef} src={src} alt={alt} loading="lazy" decoding="async" className="m-0!" />
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
            onCancel={(e) => {
              // Esc 也走缩回动画，避免关合时图片瞬间消失
              e.preventDefault();
              void hide();
            }}
            aria-label={alt ? `图片查看：${alt}` : "图片查看"}
            className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-[#e8e4da] backdrop:bg-[#0b0b0c]"
          >
            <div ref={shellRef} className="flex h-full w-full flex-col bg-[#0b0b0c]">
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[rgba(232,228,218,0.16)] px-4 py-2.5 sm:px-6">
                <span className="mono text-[0.625rem] tracking-[0.2em] text-[rgba(232,228,218,0.5)] uppercase">
                  预览 / VIEWER
                </span>
                <button
                  type="button"
                  onClick={() => void hide()}
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
                  if (e.target === e.currentTarget) void hide();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 原图放大查看，不经过 optimizer */}
                <img
                  ref={figureRef}
                  src={src}
                  alt={alt}
                  className="max-h-[88vh] max-w-[92vw] cursor-default border border-[rgba(232,228,218,0.3)] object-contain will-change-transform"
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
