import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { postCat } from "@/components/site/post-params";
import type { PostMeta } from "@/lib/types";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 相关文章：文末参数表，编号按推荐顺序排（共同标签多者优先，其次按时间）。
 * 桌面 4 列 NO. / TITLE / DATE / CAT，移动端压缩成两行。
 */
export function RelatedPosts({ posts, className }: { posts: PostMeta[]; className?: string }) {
  if (!posts.length) return null;

  return (
    <section aria-labelledby="related-title" className={cn("max-w-[39rem]", className)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-line-ink pb-2">
        <h2 id="related-title" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
          RELATED
          <span aria-hidden className="mx-2 text-faint">
            /
          </span>
          相关
        </h2>
        <span className="mono text-[0.6875rem] tracking-[0.08em] text-faint tabular-nums">
          {String(posts.length).padStart(2, "0")}
        </span>
      </div>

      <ol>
        {posts.map((p, i) => {
          const cat = postCat(p);
          return (
            <li key={p.slug} className="border-b border-line">
              <Link
                href={`/posts/${p.slug}`}
                className="group grid grid-cols-[1.75rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 py-3 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] sm:grid-cols-[2.25rem_minmax(0,1fr)_6rem_4.5rem] sm:gap-x-5"
              >
                <span className="mono text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums">{pad2(i + 1)}</span>

                <span className="min-w-0">
                  <span className="display block truncate text-[0.9375rem] leading-snug text-ink transition-colors group-hover:text-accent-ink">
                    {p.title}
                  </span>
                  <span className="mono mt-1 flex items-baseline gap-2 text-[0.625rem] tracking-[0.06em] text-faint tabular-nums sm:hidden">
                    <time dateTime={p.date}>{formatDateShort(p.date)}</time>
                    <span aria-hidden>·</span>
                    <span className="truncate uppercase">{cat ?? "—"}</span>
                  </span>
                </span>

                <time
                  dateTime={p.date}
                  className="mono hidden text-[0.6875rem] tracking-[0.06em] text-muted tabular-nums sm:block"
                >
                  {formatDateShort(p.date)}
                </time>

                <span className="mono hidden truncate text-[0.625rem] tracking-[0.08em] text-faint uppercase sm:block sm:text-right">
                  {cat ?? "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
