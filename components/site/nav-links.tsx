"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  en: string;
  match: (p: string) => boolean;
  /** 窄屏放不下时藏起来，改由页脚承接 */
  wideOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "文章", en: "ARCHIVE", match: (p: string) => p === "/" || p.startsWith("/posts") },
  { href: "/archive", label: "归档", en: "INDEX", match: (p: string) => p.startsWith("/archive") },
  { href: "/series", label: "系列", en: "SERIES", match: (p: string) => p.startsWith("/series"), wideOnly: true },
  { href: "/projects", label: "项目", en: "PROJECTS", match: (p: string) => p.startsWith("/projects"), wideOnly: true },
  { href: "/tags", label: "标签", en: "TAGS", match: (p: string) => p.startsWith("/tags") },
  { href: "/about", label: "关于", en: "ABOUT", match: (p: string) => p.startsWith("/about") },
  { href: "/search", label: "搜索", en: "SEARCH", match: (p: string) => p.startsWith("/search") },
];

/**
 * 导航：中文主标签 + 英文 mono 型号。
 * 英文只在 xl 以上显示（空间够时作为铭牌补充）；系列/项目在 md 以下交给页脚，
 * 保证 390px 下不出现被截断或横向滚动的导航。
 */
export function NavLinks() {
  const pathname = usePathname() ?? "/";
  return (
    <ul className="flex items-center gap-x-4 sm:gap-x-5 lg:gap-x-6">
      {NAV.map((item) => {
        const active = item.match(pathname);
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
              <span className="text-[0.8125rem] leading-none tracking-tight">{item.label}</span>
              <span
                aria-hidden
                className="mono hidden text-[0.625rem] leading-none tracking-[0.1em] text-faint uppercase xl:inline"
              >
                {item.en}
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
