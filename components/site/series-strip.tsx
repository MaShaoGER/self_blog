import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PostMeta } from "@/lib/types";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 系列条：只有属于系列的文章才出现。
 * 分册号按 getSeries 的时间正序，新文章追加为最后一册，编号因此稳定；
 * 上一册 / 下一册与文末 ADJACENT 是两条独立线索（同系列 vs 全站时间相邻）。
 */
export function SeriesStrip({
  name,
  posts,
  current,
  className,
}: {
  name: string;
  /** 按时间正序，含当前篇 */
  posts: PostMeta[];
  current: string;
  className?: string;
}) {
  const i = posts.findIndex((p) => p.slug === current);
  if (i < 0) return null;

  const prev = i > 0 ? posts[i - 1] : undefined;
  const next = i < posts.length - 1 ? posts[i + 1] : undefined;

  return (
    <nav aria-label="所属系列" className={cn("border-t border-line-ink", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2">
        <span className="mono flex min-w-0 items-baseline gap-1.5 text-[0.6875rem] tracking-[0.14em] uppercase">
          <span className="text-faint">SERIES</span>
          <span aria-hidden className="text-faint">
            /
          </span>
          <Link
            href={`/series/${encodeURIComponent(name)}`}
            className="min-w-0 truncate text-ink transition-colors hover:text-accent-ink"
          >
            {name}
          </Link>
        </span>

        <span className="mono shrink-0 text-[0.6875rem] tracking-[0.14em] text-faint uppercase tabular-nums">
          PART <span className="text-accent-ink">{pad2(i + 1)}</span> OF {pad2(posts.length)}
        </span>
      </div>

      {(prev || next) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line py-1.5">
          {prev ? (
            <Link
              href={`/posts/${prev.slug}`}
              rel="prev"
              className="group flex min-w-0 items-baseline gap-2 py-0.5 transition-colors"
            >
              <span className="mono shrink-0 text-[0.625rem] tracking-[0.1em] whitespace-nowrap text-accent-ink uppercase tabular-nums">
                ← PART {pad2(i)}
              </span>
              <span className="min-w-0 truncate text-[0.8125rem] leading-snug text-muted transition-colors group-hover:text-accent-ink">
                <span className="sr-only">上一册：</span>
                {prev.title}
              </span>
            </Link>
          ) : (
            <span aria-hidden className="hidden sm:block" />
          )}

          {next && (
            <Link
              href={`/posts/${next.slug}`}
              rel="next"
              className="group ml-auto flex min-w-0 items-baseline gap-2 py-0.5 transition-colors"
            >
              <span className="min-w-0 truncate text-[0.8125rem] leading-snug text-muted transition-colors group-hover:text-accent-ink">
                <span className="sr-only">下一册：</span>
                {next.title}
              </span>
              <span className="mono shrink-0 text-[0.625rem] tracking-[0.1em] whitespace-nowrap text-accent-ink uppercase tabular-nums">
                PART {pad2(i + 2)} →
              </span>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
