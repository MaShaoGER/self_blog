"use client";

import { useEffect } from "react";
import { ViewTransition } from "react";
import { usePathname } from "next/navigation";
// React 19.3 的 <ViewTransition> 类型只在 canary 类型入口里声明
import type {} from "react/canary";

declare global {
  interface Window {
    __titleDepartureAt?: number;
  }
}

/**
 * 换页过渡：新页自下方 8px 滑入并淡入；旧页交给根快照默认淡出
 * （chrome.css 里把根过渡的时长对齐到 --dur-2）。
 * 顶栏与页脚在布局里、不在快照组内，保持不动。
 *
 * 布局本身不会重挂，enter/exit 只在 keyed 边界上触发，所以按 pathname 换 key。
 *
 * 例外：从目录行点进文章页时，PostTitle 会自己把大标题从目录行滑到页头。
 * 只要启动视图过渡，浏览器就会把实时 DOM 换成快照，标题会被定格在动画起始帧、
 * 过渡结束后再跳到终点。所以这种导航干脆不渲染过渡边界（旧边界 exit="none"
 * 也不参与），让标题动画照常播放。
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  // 目录行点击时记一笔；PostTitle 自己也记录了同一个起点位置。
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest('a[href^="/posts/"]');
      if (link?.querySelector("[data-title]")) window.__titleDepartureAt = performance.now();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // 与 PostTitle 自己的 1500ms 判定窗口一致：超时的起点它也不再用。
  const titleSlide =
    pathname.startsWith("/posts/") &&
    typeof window !== "undefined" &&
    window.__titleDepartureAt !== undefined &&
    performance.now() - window.__titleDepartureAt < 1500;

  if (titleSlide) return <>{children}</>;

  return (
    <ViewTransition key={pathname} enter="chrome-page-in" exit="none" default="none">
      {children}
    </ViewTransition>
  );
}
