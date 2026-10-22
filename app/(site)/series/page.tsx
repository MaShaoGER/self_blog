import type { Metadata } from "next";
import Link from "next/link";
import { getAllSeries } from "@/lib/posts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "系列" };

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 起止年份：同年只写一次，跨年写成 2025–2026。 */
function yearSpan(dates: string[]): string {
  const first = dates[0]?.slice(0, 4) ?? "———";
  const last = dates.at(-1)?.slice(0, 4) ?? first;
  return first === last ? first : `${first}–${last}`;
}

/**
 * 系列索引 = 丛书目录。
 * 每项：序号 + 系列名 + 起止年份 + 篇数 + 1px 编码条（长度按篇数比例）。
 * 与标签索引同构；多一列年份，因为系列是有时间跨度的连续出版物。
 */
export default async function SeriesPage() {
  const series = await getAllSeries();
  const max = Math.max(1, ...series.map((s) => s.posts.length));

  return (
    <div className="sheet">
      <header className="wrap border-b border-line-ink pt-10 pb-8 lg:pt-14 lg:pb-10">
        <p className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
          SERIES <span aria-hidden className="text-faint">/</span> 索引
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <h1 className="display text-[clamp(2.75rem,9vw,5.25rem)]">系列</h1>
            <p className="mt-4 max-w-[46ch] leading-relaxed text-ink-soft">
              同一系列的文章按发布时间正序自动编成分册。编码条长度对应篇数，最长者为当前最大值。
            </p>
          </div>

          <p className="mono shrink-0 text-[0.75rem] tracking-[0.1em] whitespace-nowrap text-ink uppercase tabular-nums">
            {pad2(series.length)} SERIES
            <span aria-hidden className="mx-1.5 text-faint">
              /
            </span>
            MAX {pad2(max)}
          </p>
        </div>
      </header>

      <section aria-labelledby="series-index" className="wrap py-8 lg:py-10">
        <div className="mb-6 flex items-end justify-between gap-6">
          <h2 id="series-index" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
            INDEX / 系列表
          </h2>
          <span aria-hidden className="mono hidden text-[0.625rem] tracking-[0.08em] text-faint uppercase sm:block">
            NO. · SERIES · SPAN · ENTRIES
          </span>
        </div>

        {series.length === 0 ? (
          <div className="border-t border-line-ink py-14">
            <p className="display text-[1.5rem] text-ink">NO RECORDS</p>
            <p className="mt-2 max-w-[52ch] text-muted">
              还没有成系列的文章。在后台「文章设置」里给几篇文章填上同一个系列名，它们就会按时间自动编成分册。
            </p>
          </div>
        ) : (
          <ul className="border-t border-line-ink">
            {series.map((s, i) => {
              const span = yearSpan(s.posts.map((p) => p.date));
              return (
                <li key={s.name} className="border-b border-line">
                  <Link
                    href={`/series/${encodeURIComponent(s.name)}`}
                    className="group grid grid-cols-[2.25rem_minmax(0,1fr)_2.5rem] items-baseline gap-x-3 gap-y-2 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] sm:grid-cols-[3.5rem_minmax(0,1fr)_6.5rem_3.5rem_2rem] sm:gap-x-6 sm:py-[1.125rem]"
                  >
                    <span className="mono text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums">
                      {pad2(i + 1)}
                    </span>

                    <span className="min-w-0">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="display block min-w-0 flex-1 truncate text-[1.0625rem] leading-tight text-ink transition-colors group-hover:text-accent-ink md:text-[1.1875rem]">
                          {s.name}
                        </span>
                        {/* 移动端把年份并入标题行，避免多占一行 */}
                        <span className="mono shrink-0 text-[0.625rem] tracking-[0.06em] text-muted tabular-nums sm:hidden">
                          {span}
                        </span>
                      </span>
                      {/* 1px 编码条：长度 = 该系列篇数占最大值的比例。
                          外层限制最长 18rem，避免整行宽度看起来像标题下划线 */}
                      <span aria-hidden className="mt-2 block h-px w-full max-w-[18rem] bg-line">
                        <span
                          className="block h-px bg-ink transition-colors group-hover:bg-accent"
                          style={{ width: `${Math.max(8, Math.round((s.posts.length / max) * 100))}%` }}
                        />
                      </span>
                    </span>

                    <span className="mono hidden text-[0.6875rem] tracking-[0.06em] text-muted tabular-nums sm:block">
                      {span}
                    </span>

                    <span className="mono text-right text-[0.75rem] tracking-[0.06em] text-ink tabular-nums">
                      {pad2(s.posts.length)}
                      <span className="sr-only"> 篇</span>
                    </span>

                    <span
                      aria-hidden
                      className="mono hidden self-center text-right text-[0.875rem] text-faint transition-transform duration-150 group-hover:translate-x-1 group-hover:text-accent sm:block"
                    >
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
