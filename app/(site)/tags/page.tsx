import type { Metadata } from "next";
import Link from "next/link";
import { getAllTags } from "@/lib/posts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "标签" };

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 标签索引 = 档案网格。
 * 每项：序号 + 标签名 + 计数 + 1px 编码条（长度按文章数比例）。
 * hover 用底色而非卡片，零圆角。
 */
export default async function TagsPage() {
  const tags = await getAllTags();
  const max = Math.max(1, ...tags.map((t) => t.count));

  return (
    <div className="sheet">
      <header className="wrap border-b border-line-ink pt-10 pb-8 lg:pt-14 lg:pb-10">
        <p className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
          TAGS <span aria-hidden className="text-faint">/</span> 索引
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <h1 className="display text-[clamp(2.75rem,9vw,5.25rem)]">标签</h1>
            <p className="mt-4 max-w-[46ch] leading-relaxed text-ink-soft">
              按文章数从多到少排列；编码条长度对应篇数，最长者为当前最大值。
            </p>
          </div>

          <p className="mono shrink-0 text-[0.75rem] tracking-[0.1em] whitespace-nowrap text-ink uppercase tabular-nums">
            {pad2(tags.length)} TAGS
            <span aria-hidden className="mx-1.5 text-faint">
              /
            </span>
            MAX {pad2(max)}
          </p>
        </div>
      </header>

      <section aria-labelledby="tag-index" className="wrap py-8 lg:py-10">
        <div className="mb-6 flex items-end justify-between gap-6">
          <h2 id="tag-index" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
            INDEX / 标签表
          </h2>
          <span aria-hidden className="mono hidden text-[0.625rem] tracking-[0.08em] text-faint uppercase sm:block">
            NO. · TAG · ENTRIES
          </span>
        </div>

        {tags.length === 0 ? (
          <div className="border-t border-line-ink py-14">
            <p className="display text-[1.5rem] text-ink">NO RECORDS</p>
            <p className="mt-2 max-w-[52ch] text-muted">
              还没有带标签的文章。文章发布时加上标签，这里会自动列出。
            </p>
          </div>
        ) : (
          <ul className="grid border-t border-line-ink sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
            {tags.map((t, i) => (
              <li key={t.tag} className="border-b border-line">
                <Link
                  href={`/tags/${encodeURIComponent(t.tag)}`}
                  className="group flex items-baseline gap-3 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] md:gap-4"
                >
                  <span className="mono shrink-0 text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums">
                    {pad2(i + 1)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="display block truncate text-[1.0625rem] leading-tight text-ink transition-colors group-hover:text-accent-ink md:text-[1.1875rem]">
                      {t.tag}
                    </span>
                    {/* 1px 编码条：长度 = 该标签篇数占最大值的比例 */}
                    <span aria-hidden className="mt-2 block h-px w-full bg-line">
                      <span
                        className="block h-px bg-ink transition-colors group-hover:bg-accent"
                        style={{ width: `${Math.max(6, Math.round((t.count / max) * 100))}%` }}
                      />
                    </span>
                  </span>

                  <span className="mono shrink-0 text-right text-[0.75rem] tracking-[0.06em] text-ink tabular-nums">
                    {pad2(t.count)}
                    <span className="sr-only"> 篇</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
