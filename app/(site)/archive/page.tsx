import type { Metadata } from "next";
import { getLivePosts } from "@/lib/posts";
import { PostIndex } from "@/components/site/post-index";
import { dateParts } from "@/components/site/num-text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "归档" };

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 归档页 = 档案目录。
 * 版式：计数铭牌（NN ENTRIES / 起止年份）→ 年份跳转条 → 参数表目录。
 * 标记只用 PostIndex 的编号列，不额外加装饰性图形。
 */
export default async function ArchivePage() {
  const posts = await getLivePosts();

  const yearCounts = new Map<string, number>();
  for (const p of posts) {
    const { year } = dateParts(p.date);
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
  }
  const years = [...yearCounts.keys()].sort((a, b) => b.localeCompare(a));
  const span = years.length > 1 ? `${years.at(-1)}–${years[0]}` : (years[0] ?? "———");

  return (
    <div className="sheet">
      <header className="wrap border-b border-line-ink pt-10 pb-8 lg:pt-14 lg:pb-10">
        <p className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
          ARCHIVE <span aria-hidden className="text-faint">/</span> 索引
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <h1 className="display text-[clamp(2.75rem,9vw,5.25rem)]">归档</h1>
            <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-soft">
              按发布时间倒序排列，以年份归档。编号为目录内序号，越新越大。
            </p>
          </div>

          <p className="mono shrink-0 text-[0.8125rem] tracking-[0.1em] text-ink uppercase tabular-nums">
            {pad2(posts.length)} ENTRIES
            <span aria-hidden className="mx-1.5 text-faint">
              /
            </span>
            {span}
          </p>
        </div>
      </header>

      {years.length > 0 && (
        <nav aria-label="按年份跳转" className="wrap border-b border-line">
          <ul className="flex flex-wrap items-baseline gap-x-7 gap-y-2 py-3">
            <li className="mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">YEAR</li>
            {years.map((y) => (
              <li key={y}>
                <a
                  href={`#y-${y}`}
                  className="group flex items-baseline gap-1.5 transition-colors hover:text-accent-ink"
                >
                  <span className="mono text-[0.75rem] tracking-[0.08em] text-ink tabular-nums group-hover:text-accent-ink">
                    {y}
                  </span>
                  <span className="mono text-[0.625rem] tracking-[0.06em] text-faint tabular-nums">
                    {pad2(yearCounts.get(y) ?? 0)}
                  </span>
                </a>
              </li>
            ))}
            <li
              aria-hidden
              className="mono ml-auto hidden text-[0.625rem] tracking-[0.14em] text-faint uppercase sm:block"
            >
              DESC / DATE
            </li>
          </ul>
        </nav>
      )}

      <section aria-labelledby="archive-index" className="wrap py-8 lg:py-10">
        <div className="mb-6 flex items-end justify-between gap-6">
          <h2 id="archive-index" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
            INDEX / 目录
          </h2>
          <span aria-hidden className="mono hidden text-[0.625rem] tracking-[0.08em] text-faint uppercase sm:block">
            NO. · TITLE · DATE · CAT · MIN
          </span>
        </div>

        {posts.length === 0 ? (
          <div className="border-t border-line-ink py-14">
            <p className="display text-[1.5rem] text-ink">NO RECORDS</p>
            <p className="mt-2 max-w-[52ch] text-muted">还没有发布的文章。发布后会按年份自动归入这里。</p>
          </div>
        ) : (
          <PostIndex posts={posts} compact />
        )}
      </section>
    </div>
  );
}
