"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { NAV_DESTINATIONS, type SiteNavigation } from "@/shared/site-chrome";

type Bar = { x: number; y: number; w: number };

/**
 * 导航：中文主标签 + 英文 mono 型号。
 * 英文只在 xl 以上显示（空间够时作为铭牌补充）；系列/项目在 md 以下交给页脚，
 * 保证 390px 下不出现被截断或横向滚动的导航。
 *
 * 当前栏目由一条共用的橙色短线标记：换栏目时同一条线滑过去，
 * 而不是各自淡入淡出。线用 transform 定位/拉伸，不动布局。
 */
export function NavLinks({ navigation }: { navigation: SiteNavigation }) {
  const pathname = usePathname() ?? "/";
  const listRef = useRef<HTMLUListElement>(null);
  const prevPath = useRef(pathname);
  const shiftTimer = useRef<number | undefined>(undefined);
  const [bar, setBar] = useState<Bar | null>(null);
  const [animated, setAnimated] = useState(false);
  const [shift, setShift] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const changed = prevPath.current !== pathname;
    prevPath.current = pathname;

    const measure = () => {
      const active = list.querySelector<HTMLElement>('[aria-current="page"]');
      setBar(
        active
          ? { x: active.offsetLeft, y: active.offsetTop + active.offsetHeight - 2, w: active.offsetWidth }
          : null,
      );
    };
    measure();

    // 换页过渡期间顶栏是快照；等页面交接完（--dur-2）再让线滑过去，
    // 和 setBar 同一次提交，延迟才会作用在这一段位移上。
    if (changed) {
      setShift(true);
      window.clearTimeout(shiftTimer.current);
      shiftTimer.current = window.setTimeout(() => setShift(false), 800);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const item of list.children) observer.observe(item);
    return () => observer.disconnect();
  }, [pathname]);

  // 首次定位不带动画：先落位，再允许过渡。
  useEffect(() => setAnimated(true), []);
  useEffect(() => () => window.clearTimeout(shiftTimer.current), []);

  return (
    <div className="relative min-w-0">
      <ul ref={listRef} className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-5 lg:gap-x-6">
        {NAV_DESTINATIONS.map((item) => {
          const active =
            item.key === "home"
              ? pathname === "/" || pathname.startsWith("/posts/")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className={cn("shrink-0", item.wideOnly && "hidden md:block")}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-baseline gap-1.5 py-2 whitespace-nowrap transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                <span className="text-[0.8125rem] leading-none tracking-tight">{navigation[item.key].label}</span>
                <span
                  aria-hidden
                  className="mono hidden text-[0.625rem] leading-none tracking-[0.1em] text-faint uppercase xl:inline"
                >
                  {navigation[item.key].en}
                </span>
                {!active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-ink transition-transform duration-150 group-hover:scale-x-100"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {bar && (
        <span
          aria-hidden
          data-anim={animated}
          data-shift={shift}
          className="nav-active-bar"
          style={{ transform: `translate(${bar.x}px, ${bar.y}px) scaleX(${bar.w})` }}
        />
      )}
    </div>
  );
}
