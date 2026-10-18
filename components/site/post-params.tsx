import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { SilkStrip } from "@/components/ui/hardware";
import type { PostMeta } from "@/lib/types";

/** 目录编号：与首页 / 归档同一套（列表 newest first，倒序从 001 起）。 */
export function entryNo(index: number, total: number): string {
  return String(total - index).padStart(3, "0");
}

/** 修订号：发布时间与最后修改时间不同日，才算 REV.02。 */
export function revNo(date: string, updated?: string): string {
  return updated && updated.slice(0, 10) !== date.slice(0, 10) ? "02" : "01";
}

/** 分类：沿用文章索引的做法，取第一个标签作为 CAT。 */
export function postCat(post: Pick<PostMeta, "tags">): string | null {
  return post.tags[0] ?? null;
}

/** 桌面左栏 SPEC：手册的铭牌参数块。只列真实字段。 */
export function SpecSheet({ post, className }: { post: PostMeta; className?: string }) {
  const rows: { k: string; v: React.ReactNode }[] = [
    { k: "DATE", v: formatDateShort(post.date) },
    { k: "WORDS", v: post.wordCount.toLocaleString("en-US") },
    {
      k: "TAGS",
      v: post.tags.length ? (
        <span className="flex flex-col items-end gap-0.5">
          {post.tags.map((t) => (
            <Link key={t} href={`/tags/${encodeURIComponent(t)}`} className="transition-colors hover:text-accent-ink">
              #{t}
            </Link>
          ))}
        </span>
      ) : (
        "—"
      ),
    },
    { k: "REV.", v: revNo(post.date, post.updated) },
  ];
  if (post.status !== "published") {
    rows.push({ k: "STATUS", v: post.status === "scheduled" ? "SCHEDULED" : "DRAFT" });
  }

  return (
    <div className={cn("metal p-3 pt-4", className)}>
      <SilkStrip className="mb-2.5">SPEC / PLN-01</SilkStrip>
      <dl>
        {rows.map((row) => (
          <div
            key={row.k}
            className="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0"
            style={{ borderColor: "var(--metal-line)" }}
          >
            <dt className="mono text-[0.6875rem] tracking-[0.12em] uppercase opacity-70">{row.k}</dt>
            <dd className="mono text-right text-[0.75rem] leading-relaxed tracking-[0.05em] tabular-nums">{row.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 移动端：标题下的参数块，桌面由左栏 SPEC 取代。 */
export function MetaStrip({ post, className }: { post: PostMeta; className?: string }) {
  const cat = postCat(post);
  const rows = [
    { k: "DATE", v: formatDateShort(post.date) },
    { k: "WORDS", v: post.wordCount.toLocaleString("en-US") },
    { k: "CAT", v: cat ?? "—" },
    { k: "READ", v: `${post.readingTime} MIN` },
  ];

  return (
    <dl className={cn("grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4", className)}>
      {rows.map((row) => (
        <div key={row.k} className="min-w-0 border-t border-line pt-2">
          <dt className="mono text-[0.6875rem] tracking-[0.14em] text-faint uppercase">{row.k}</dt>
          <dd className="mono mt-1 truncate text-[0.75rem] leading-relaxed tracking-[0.05em] text-ink tabular-nums">
            {row.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 文末修订记录：只列真实发生的发布与更新，不编造版本。 */
export function RevisionLog({ post, className }: { post: PostMeta; className?: string }) {
  const revised = revNo(post.date, post.updated) === "02";
  const rows: { rev: string; date: string; note: string; current: boolean }[] = [
    { rev: "01", date: post.date, note: "初稿发布", current: !revised },
    ...(revised ? [{ rev: "02", date: post.updated!, note: "内容修订", current: true }] : []),
  ];
  const latest = rows[rows.length - 1];

  return (
    <section aria-labelledby="revision-title" className={cn("max-w-[39rem]", className)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-line-ink pb-2">
        <h2 id="revision-title" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
          REVISION LOG
          <span aria-hidden className="mx-2 text-faint">
            /
          </span>
          修订记录
        </h2>
        <span className="mono text-[0.6875rem] tracking-[0.1em] text-faint tabular-nums uppercase">
          CURRENT REV.{latest?.rev}
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="mono text-[0.6875rem] tracking-[0.14em] text-faint uppercase">
            <th scope="col" className="w-12 pt-2.5 pb-1.5 text-left font-normal">
              REV
            </th>
            <th scope="col" className="w-28 pt-2.5 pb-1.5 text-left font-normal">
              DATE
            </th>
            <th scope="col" className="pt-2.5 pb-1.5 text-left font-normal">
              NOTE
            </th>
            <th scope="col" className="w-24 pt-2.5 pb-1.5 text-right font-normal">
              STATE
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rev} className="border-t border-line">
              <td className="mono py-2 align-baseline text-[0.75rem] tracking-[0.06em] text-ink tabular-nums">
                {row.rev}
              </td>
              <td className="mono py-2 align-baseline text-[0.75rem] tracking-[0.06em] text-muted tabular-nums">
                {formatDateShort(row.date)}
              </td>
              <td className="py-2 align-baseline text-[0.875rem] leading-relaxed text-ink-soft">{row.note}</td>
              <td className="mono py-2 text-right align-baseline text-[0.6875rem] tracking-[0.12em] uppercase">
                {row.current ? <span className="text-accent-ink">CURRENT</span> : <span className="text-faint">VOID</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
