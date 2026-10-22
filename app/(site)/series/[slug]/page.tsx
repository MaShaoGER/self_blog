import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeries } from "@/lib/posts";
import { dateParts } from "@/components/site/num-text";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decode((await params).slug);
  return { title: `系列：${name}` };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 单系列页 = 分册清单。
 * 面包屑是唯一的结构标记；分册编号 PART / 日期 / 分钟由 mono 参数列承载。
 * posts 已按时间正序，编号因此稳定——新文章总是追加为最后一册。
 */
export default async function SeriesDetailPage({ params }: Props) {
  const name = decode((await params).slug);
  const group = await getSeries(name);
  if (!group) notFound();

  const { posts } = group;
  const first = dateParts(posts[0]!.date);
  const last = dateParts(posts.at(-1)!.date);

  return (
    <div className="sheet">
      <header className="wrap border-b border-line-ink pt-8 pb-8 lg:pt-10 lg:pb-10">
        <nav aria-label="面包屑" className="mono flex items-baseline gap-2 text-[0.6875rem] tracking-[0.12em] uppercase">
          <Link href="/series" className="text-muted transition-colors hover:text-accent-ink">
            系列索引
          </Link>
          <span aria-hidden className="text-faint">
            /
          </span>
          <span className="text-ink">分册</span>
        </nav>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <h1 className="display text-[clamp(2.25rem,7vw,4.5rem)] break-words">{name}</h1>
            <p className="mt-3 leading-relaxed text-muted">
              按发布时间正序编号，第一册为 PART 01；新文章自动追加在末尾。
            </p>
          </div>

          <p className="mono shrink-0 text-[0.8125rem] tracking-[0.1em] text-ink uppercase tabular-nums">
            {pad2(posts.length)} ENTRIES
            <span aria-hidden className="mx-1.5 text-faint">
              /
            </span>
            {first.year === last.year ? first.year : `${first.year}–${last.year}`}
          </p>
        </div>
      </header>

      <section aria-labelledby="series-entries" className="wrap py-8 lg:py-10">
        <div className="mb-6 flex items-end justify-between gap-6">
          <h2 id="series-entries" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
            INDEX / 分册
          </h2>
          <span aria-hidden className="mono hidden text-[0.625rem] tracking-[0.08em] text-faint uppercase sm:block">
            PART · TITLE · DATE · MIN
          </span>
        </div>

        <ol className="border-t border-line-ink">
          {posts.map((p, i) => {
            const { month, day } = dateParts(p.date);
            return (
              <li key={p.slug} className="group border-b border-line">
                <Link
                  href={`/posts/${p.slug}`}
                  className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] sm:grid-cols-[5.5rem_minmax(0,1fr)_7rem_4.5rem_2rem] sm:gap-x-6 sm:py-[1.125rem]"
                >
                  <span className="mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase tabular-nums">
                    <span className="text-faint">PART</span> {pad2(i + 1)}
                  </span>

                  <span className="min-w-0">
                    <span className="display block truncate text-[1.0625rem] leading-tight text-ink transition-colors group-hover:text-accent-ink md:text-[1.1875rem]">
                      {p.title}
                    </span>
                    <span className="mono mt-1.5 flex items-baseline gap-2 text-[0.625rem] tracking-[0.06em] text-faint tabular-nums sm:hidden">
                      <time dateTime={p.date}>
                        {p.date.slice(0, 4)}.{month}.{day}
                      </time>
                      <span aria-hidden>·</span>
                      <span>{p.readingTime} MIN</span>
                    </span>
                  </span>

                  <time
                    dateTime={p.date}
                    className="mono hidden text-[0.6875rem] tracking-[0.06em] text-muted tabular-nums sm:block"
                  >
                    {p.date.slice(0, 4)}.{month}.{day}
                  </time>

                  <span className="mono hidden text-right text-[0.6875rem] tracking-[0.06em] text-muted tabular-nums sm:block">
                    {p.readingTime} MIN
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
        </ol>

        <div className="mt-10">
          <Link href="/series" className="mono link-underline text-[0.6875rem] tracking-[0.1em] text-muted uppercase">
            ← 全部系列
          </Link>
        </div>
      </section>
    </div>
  );
}
