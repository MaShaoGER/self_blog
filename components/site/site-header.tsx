import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavLinks } from "./nav-links";
import { formatDateShort } from "@/lib/format";

/**
 * 站头：铭牌式。左 logotype（中文站名 + mono 型号），右导航 + 日期 + 主题拨杆。
 * 恒为 1px 墨线收底，滚动不浮动——档案感优先。
 */
export function SiteHeader({ title, tagline }: { title: string; tagline: string }) {
  const today = formatDateShort(new Date().toISOString());

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line-ink bg-[color-mix(in_oklab,var(--paper)_94%,transparent)] backdrop-blur-[2px]">
      <div className="wrap flex h-16 items-center justify-between gap-3 sm:gap-4">
        <Link href="/" className="flex min-w-0 shrink items-baseline gap-2.5">
          <span className="display truncate text-[1.25rem] leading-none sm:text-[1.375rem]">{title}</span>
          <span aria-hidden className="silkscreen hidden translate-y-[-1px] shrink-0 md:inline">
            SELF_BLOG
          </span>
        </Link>

        {/* min-w-0 是关键：否则导航内容会把整页撑出横向滚动 */}
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-5">
          <nav aria-label="主导航" className="min-w-0 overflow-x-auto">
            <NavLinks />
          </nav>

          <span aria-hidden className="hidden h-5 w-px shrink-0 bg-line-strong lg:block" />

          <time
            dateTime={today.replaceAll(".", "-")}
            className="mono hidden shrink-0 text-[0.6875rem] tracking-[0.08em] text-muted tabular-nums lg:block"
          >
            {today}
          </time>

          <ThemeToggle className="hidden shrink-0 sm:inline-flex" />
        </div>

        <ThemeToggle className="sm:hidden" />
      </div>

      {tagline && (
        <div className="wrap hidden border-t border-line pb-1 md:block">
          <p className="mono truncate py-1 text-[0.625rem] tracking-[0.14em] text-faint uppercase">{tagline}</p>
        </div>
      )}
    </header>
  );
}
