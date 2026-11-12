"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

/** 点击目录行时记下标题的出发位置，文章页大标题据此滑入 */
let departure: { slug: string; left: number; top: number; fontSize: number; at: number } | null = null;

/**
 * 目录行链接：指向或聚焦时才整页预取，点进去不经过 loading 占位。
 * 行内带 `data-title` 的元素是标题滑动的起点。
 */
export function PostLink({ slug, className, children }: { slug: string; className?: string; children: React.ReactNode }) {
  const [active, setActive] = useState(false);

  return (
    <Link
      href={`/posts/${slug}`}
      prefetch={active}
      onPointerEnter={() => setActive(true)}
      onFocus={() => setActive(true)}
      onClick={(e) => {
        const title = e.currentTarget.querySelector("[data-title]");
        if (!title) return;
        const r = title.getBoundingClientRect();
        departure = { slug, left: r.left, top: r.top, fontSize: parseFloat(getComputedStyle(title).fontSize), at: performance.now() };
      }}
      className={className}
    >
      {children}
    </Link>
  );
}

/**
 * 文章页大标题：从刚才点击的目录行位置滑到页头。
 * 不用 React 的共享过渡：目录常在首屏以下，滚动后两端无法配对。
 */
export function PostTitle({ slug, className, children }: { slug: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const from = departure;
    departure = null;
    const h1 = ref.current;
    if (!h1 || !from || from.slug !== slug || performance.now() - from.at > 1500) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // 导航后页面回到顶部，所以终点取文档坐标
    const to = h1.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - (to.top + window.scrollY);
    const scale = from.fontSize / parseFloat(getComputedStyle(h1).fontSize);
    h1.animate(
      [
        { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        { transformOrigin: "0 0", transform: "none" },
      ],
      { duration: 360, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
    );
  }, [slug]);

  return (
    <h1 ref={ref} className={className}>
      {children}
    </h1>
  );
}
