import Link from "next/link";
import { cn } from "@/lib/cn";

export type FilterTab = { value: string; label: string; count?: number; href: string };

/** 基于链接的筛选 tab，状态保存在 URL 里，可刷新、可分享。 */
export function FilterTabs({ tabs, current, label }: { tabs: FilterTab[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      <ul className="flex gap-5 md:gap-6">
        {tabs.map((t) => {
          const active = t.value === current;
          return (
            <li key={t.value} className="shrink-0">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 items-center gap-1.5 text-[0.875rem] transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink-soft",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={cn("tabular-nums text-[0.8125rem]", active ? "text-accent-ink" : "text-faint")}>
                    {t.count}
                  </span>
                )}
                {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-ink" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
