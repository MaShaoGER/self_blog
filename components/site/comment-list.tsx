import type { PublicComment } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * 已通过评论：编号列表，mono 元信息 + 正文平面排版。
 * 编号按时间正序，与提交顺序一致，方便引用「#03」。
 */
export function CommentList({ comments, className }: { comments: PublicComment[]; className?: string }) {
  if (!comments.length) {
    return (
      <p className={cn("mono py-8 text-[0.75rem] leading-relaxed tracking-[0.06em] text-faint uppercase", className)}>
        NO RECORDS
        <span aria-hidden className="mx-2">
          /
        </span>
        还没有评论。有想法的话，在下面写第一条。
      </p>
    );
  }

  return (
    <ol className={cn("border-b border-line", className)}>
      {comments.map((c, i) => (
        <li key={c.id} className="border-t border-line py-5">
          <div className="mono flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums">
            <span className="text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-ink">
              {c.website ? (
                <a
                  href={c.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="link-underline transition-colors"
                >
                  {c.author}
                </a>
              ) : (
                c.author
              )}
            </span>
            <time dateTime={c.createdAt} className="text-faint">
              {formatDateTime(c.createdAt)}
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink-soft">{c.body}</p>
        </li>
      ))}
    </ol>
  );
}
