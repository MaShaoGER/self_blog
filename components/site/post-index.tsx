import Link from "next/link";
import type { PostMeta } from "@/lib/types";
import { cn } from "@/lib/cn";
import { dateParts } from "./num-text";

export function groupByYear<T extends Pick<PostMeta, "date">>(posts: T[]): { year: string; posts: T[] }[] {
  const groups: { year: string; posts: T[] }[] = [];
  for (const p of posts) {
    const { year } = dateParts(p.date);
    const last = groups.at(-1);
    if (last && last.year === year) last.posts.push(p);
    else groups.push({ year, posts: [p] });
  }
  return groups;
}

/** 目录行编号：列表内倒序 NO.001 起 */
function entryNo(index: number, total: number): string {
  return String(total - index).padStart(3, "0");
}

/**
 * 文章目录：参数表版式。
 * 桌面 6 列（NO. / TITLE / DATE / CAT / MIN / →），移动端两行堆叠；语义仍是 ol > li。
 */
export function PostIndex({ posts, compact = false }: { posts: PostMeta[]; compact?: boolean }) {
  const total = posts.length;

  return (
    <div className="flex flex-col">
      {groupByYear(posts).map((g, gi) => {
        const startIndex = posts.findIndex((p) => p.slug === g.posts[0]?.slug);
        return (
          <section key={g.year} aria-labelledby={`y-${g.year}`} className={cn(gi > 0 && "mt-16 lg:mt-20")}>
            <div className="mb-0 flex items-end justify-between gap-4 border-b border-line-ink pb-2">
              <h2 id={`y-${g.year}`} className="mono text-[0.6875rem] font-medium tracking-[0.14em] text-muted uppercase">
                <span className="text-ink">{g.year}</span>
                <span aria-hidden className="mx-1.5 text-faint">
                  /
                </span>
                {String(g.posts.length).padStart(2, "0")} ENTRIES
                <span className="sr-only">年，{g.posts.length} 篇</span>
              </h2>
              <span aria-hidden className="ruler mb-1 hidden w-24 text-line-strong sm:block" />
            </div>

            <ol className="border-t-0">
              {g.posts.map((p, i) => {
                const idx = startIndex >= 0 ? startIndex + i : i;
                const no = entryNo(idx, total);
                const { month, day } = dateParts(p.date);
                const cat = p.tags[0];
                const extra = Math.max(0, p.tags.length - 1);

                return (
                  <li key={p.slug} className="group border-b border-line">
                    <Link
                      href={`/posts/${p.slug}`}
                      className={cn(
                        "relative grid items-baseline gap-x-5 gap-y-1.5 py-4 transition-colors",
                        "hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)]",
                        "grid-cols-[2.75rem_minmax(0,1fr)_2.5rem]",
                        "md:grid-cols-[4.5rem_minmax(0,1fr)_7rem_5.5rem_3.5rem_2rem] md:py-[1.125rem]",
                        compact && "md:grid-cols-[4.5rem_minmax(0,1fr)_7rem_5.5rem_3.5rem_2rem]",
                      )}
                    >
                      <span className="mono text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums">{no}</span>

                      <span className="min-w-0">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="display block min-w-0 flex-1 truncate text-[1.0625rem] leading-tight text-ink transition-colors group-hover:text-accent-ink md:text-[1.1875rem]">
                            {p.title}
                          </span>
                          {p.status === "scheduled" && (
                            <span className="mono shrink-0 border border-signal px-1 py-px text-[0.625rem] tracking-[0.08em] text-signal uppercase">
                              SCH
                            </span>
                          )}
                        </span>
                        {p.excerpt && (
                          <span className="mt-1 line-clamp-1 max-w-[62ch] text-[0.8125rem] leading-relaxed text-muted">
                            {p.excerpt}
                          </span>
                        )}
                      </span>

                      <time
                        dateTime={p.date}
                        className="mono hidden text-[0.6875rem] tracking-[0.06em] text-muted tabular-nums md:block"
                      >
                        {p.date.slice(0, 4)}.{month}.{day}
                      </time>

                      <span className="hidden md:block">
                        {cat ? (
                          <span className="inline-flex max-w-full items-baseline border border-line-strong px-1.5 py-[3px] text-[0.6875rem] leading-none text-ink">
                            <span className="truncate">{cat}</span>
                            {extra > 0 && <span className="mono ml-1 text-[0.625rem] text-faint">+{extra}</span>}
                          </span>
                        ) : (
                          <span aria-hidden className="mono text-[0.6875rem] text-faint">
                            —
                          </span>
                        )}
                      </span>

                      <span className="mono hidden text-right text-[0.6875rem] tracking-[0.06em] text-muted tabular-nums md:block">
                        {p.readingTime} MIN
                      </span>

                      <span
                        aria-hidden
                        className="mono self-center text-right text-[0.875rem] text-faint transition-transform duration-150 group-hover:translate-x-1 group-hover:text-accent"
                      >
                        →
                      </span>

                      <span className="mono col-span-2 col-start-2 flex items-center gap-2 text-[0.625rem] tracking-[0.06em] text-faint tabular-nums md:hidden">
                        <time dateTime={p.date}>
                          {p.date.slice(0, 4)}.{month}.{day}
                        </time>
                        <span aria-hidden>·</span>
                        <span>{p.readingTime} MIN</span>
                        {cat && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="uppercase">{cat}</span>
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
