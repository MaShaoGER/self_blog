import type { Metadata } from "next";
import Link from "next/link";
import { getLivePosts, searchPosts } from "@/lib/posts";
import { dateParts } from "@/components/site/num-text";
import { GrooveInput } from "@/components/ui/controls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "搜索" };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi");
  const lower = new Set(terms.map((t) => t.toLowerCase()));
  return (
    <>
      {text.split(re).map((part, i) =>
        lower.has(part.toLowerCase()) ? (
          <mark key={i} className="hit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 搜索页 = 检索终端。
 * 凹槽输入 + 键帽提交是唯一的写实控件点位；结果按相关度排序，编号即排名。
 */
export default async function SearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";
  const [results, allPosts] = await Promise.all([q ? searchPosts(q) : Promise.resolve([]), getLivePosts()]);
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);

  return (
    <div className="sheet">
      <header className="wrap border-b border-line-ink pt-10 pb-8 lg:pt-14 lg:pb-10">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <p className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
              SEARCH <span aria-hidden className="text-faint">/</span> 检索
            </p>
            <h1 className="display mt-4 text-[clamp(2.75rem,9vw,5.25rem)]">搜索</h1>
            <p className="mt-4 max-w-[46ch] leading-relaxed text-ink-soft">
              在标题、正文与标签中查找。多个关键词用空格隔开，全部命中才计入结果。
            </p>
          </div>

          <p className="mono shrink-0 text-[0.8125rem] tracking-[0.1em] text-ink uppercase tabular-nums">
            INDEX
            <span aria-hidden className="mx-1.5 text-faint">
              /
            </span>
            {pad2(allPosts.length)} ENTRIES
          </p>
        </div>

        <form action="/search" method="get" role="search" className="mt-8 flex max-w-[48rem] items-stretch gap-2 sm:gap-3">
          <span
            aria-hidden
            className="mono hidden shrink-0 items-center text-[0.625rem] tracking-[0.14em] text-faint uppercase sm:flex"
          >
            QUERY
          </span>
          <label htmlFor="q" className="sr-only">
            搜索关键词
          </label>
          <GrooveInput
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="输入关键词"
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 flex-1"
          />
          <button type="submit" className="keybtn keybtn-safety h-11 shrink-0 px-5">
            检索
            <span aria-hidden>↵</span>
          </button>
        </form>
      </header>

      <section aria-labelledby="search-results" className="wrap py-8 lg:py-10">
        <div className="mb-6 flex items-end justify-between gap-6">
          <h2 id="search-results" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
            {q ? `HITS / ${pad2(results.length)}` : "QUERY / 待输入"}
          </h2>
          <span aria-hidden className="mono hidden text-[0.625rem] tracking-[0.08em] text-faint uppercase sm:block">
            RANK · TITLE · DATE · CAT · MIN
          </span>
        </div>

        <div aria-live="polite">
          {!q ? (
            <div className="border-t border-line-ink pt-6">
              <p className="display text-[1.5rem] text-ink">NO QUERY ENTERED</p>
              <p className="mono mt-2 text-[0.6875rem] tracking-[0.12em] text-faint uppercase">
                TYPE A TERM TO BEGIN
              </p>
              <p className="mt-4 max-w-[56ch] leading-relaxed text-muted">
                先输入关键词再回车。也可以按年份浏览
                <Link href="/archive" className="link-underline mx-1 text-ink-soft">
                  归档
                </Link>
                ，或从
                <Link href="/tags" className="link-underline mx-1 text-ink-soft">
                  标签
                </Link>
                进入。
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="border-t border-line-ink pt-6">
              <p className="display text-[1.5rem] text-ink">NO RECORDS FOUND</p>
              <p className="mono mt-2 text-[0.6875rem] tracking-[0.12em] text-faint uppercase">
                TRY ANOTHER QUERY
              </p>
              <p className="mt-4 max-w-[56ch] leading-relaxed text-muted">
                没有找到包含「{q}」的文章。换个说法，或者少用几个关键词再试。
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-[0.9375rem] text-muted">
                「{q}」命中 <span className="num text-ink">{results.length}</span> 篇
              </p>
              <ol className="border-t border-line-ink">
                {results.map((r, i) => {
                  const { month, day } = dateParts(r.date);
                  const cat = r.tags[0];
                  const extra = Math.max(0, r.tags.length - 1);
                  return (
                    <li key={r.slug} className="group border-b border-line">
                      <Link
                        href={`/posts/${r.slug}`}
                        className="grid items-baseline gap-x-5 gap-y-1.5 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] md:grid-cols-[4.5rem_minmax(0,1fr)_7rem_5.5rem_3.5rem_2rem] md:py-5"
                      >
                        <span className="mono hidden text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums md:block">
                          {pad2(i + 1)}
                        </span>

                        <span className="min-w-0">
                          <span className="display block text-[1.0625rem] leading-tight text-ink transition-colors group-hover:text-accent-ink md:text-[1.1875rem]">
                            <Highlight text={r.title} terms={terms} />
                          </span>
                          {r.snippet && (
                            <span className="mt-1.5 line-clamp-2 block max-w-[68ch] text-[0.875rem] leading-relaxed text-muted">
                              <Highlight text={r.snippet} terms={terms} />
                            </span>
                          )}
                          <span className="mono mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums md:hidden">
                            <time dateTime={r.date}>
                              {r.date.slice(0, 4)}.{month}.{day}
                            </time>
                            <span aria-hidden>·</span>
                            <span>{r.readingTime} MIN</span>
                          </span>
                        </span>

                        <time
                          dateTime={r.date}
                          className="mono hidden text-[0.6875rem] tracking-[0.06em] text-muted tabular-nums md:block"
                        >
                          {r.date.slice(0, 4)}.{month}.{day}
                        </time>

                        <span className="hidden md:block">
                          {cat ? (
                            <span className="mono inline-block max-w-full truncate border border-line-strong px-1.5 py-0.5 text-[0.6875rem] tracking-[0.08em] text-ink uppercase">
                              {cat}
                              {extra > 0 && <span className="text-faint"> +{extra}</span>}
                            </span>
                          ) : (
                            <span aria-hidden className="mono text-[0.6875rem] text-faint">
                              —
                            </span>
                          )}
                        </span>

                        <span className="mono hidden text-right text-[0.6875rem] tracking-[0.06em] text-muted tabular-nums md:block">
                          {r.readingTime} MIN
                        </span>

                        <span
                          aria-hidden
                          className="mono hidden self-center text-right text-[0.875rem] text-faint transition-transform duration-150 group-hover:translate-x-1 group-hover:text-accent md:block"
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
