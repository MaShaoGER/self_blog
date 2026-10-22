"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_DESTINATIONS, type SiteNavigation } from "@/shared/site-chrome";

/**
 * 导航：中文主标签 + 英文 mono 型号。
 * 英文只在 xl 以上显示（空间够时作为铭牌补充）；系列/项目在 md 以下交给页脚，
 * 保证 390px 下不出现被截断或横向滚动的导航。
 */
export function NavLinks({ navigation }: { navigation: SiteNavigation }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-5 lg:gap-x-6">
      {NAV_DESTINATIONS.map((item) => {
        const active = item.key === "home" ? pathname === "/" || pathname.startsWith("/posts/") : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 bottom-0 h-[2px] origin-left transition-transform duration-150",
                  active ? "scale-x-100 bg-accent" : "scale-x-0 bg-ink group-hover:scale-x-100",
                )}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
