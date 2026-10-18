"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePostAction } from "@/app/admin/posts/actions";
import { cn } from "@/lib/cn";
import { ConfirmButton } from "./confirm-button";
import { PostStatusTag, postHref, type EffectiveStatus } from "./post-status";

const actionCls =
  "inline-flex h-11 items-center px-2.5 text-[0.8125rem] text-muted transition-colors hover:text-ink md:h-9";

export function PostRow({
  slug,
  title,
  status,
  viewable,
  dateText,
  dateIso,
  dateLabel,
  wordCount,
  tags,
}: {
  slug: string;
  title: string;
  status: EffectiveStatus;
  viewable: boolean;
  dateText: string;
  dateIso: string;
  dateLabel: string;
  wordCount: number;
  tags: string[];
}) {
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3.5 md:grid-cols-[minmax(0,1fr)_6rem_9.5rem_auto]">
      <div className="min-w-0">
        <Link
          href={`/admin/posts/${slug}/edit`}
          className="block truncate text-[0.9375rem] font-medium text-ink hover:text-accent-ink"
        >
          {title}
        </Link>
        <p className="mt-0.5 truncate text-[0.8125rem] text-muted">
          <span className="font-mono text-[0.75rem] text-faint">/{slug}</span>
          <span className="ml-3 tabular-nums">{wordCount} 字</span>
          {tags.length > 0 && <span className="ml-3">{tags.map((t) => `#${t}`).join(" ")}</span>}
        </p>
      </div>

      <div className="col-start-1 row-start-2 flex items-center gap-3 md:col-start-auto md:row-start-auto">
        <PostStatusTag status={status} />
        <span className="text-[0.8125rem] text-muted md:hidden">
          {dateLabel} <time dateTime={dateIso} className="tabular-nums">{dateText}</time>
        </span>
      </div>

      <time
        dateTime={dateIso}
        className={cn(
          "hidden text-[0.8125rem] tabular-nums md:block",
          status === "scheduled" ? "text-accent-ink" : "text-muted",
        )}
      >
        {dateText}
      </time>

      <div className="col-start-2 row-span-2 row-start-1 -mr-2.5 flex items-center md:row-span-1 md:col-start-auto md:row-start-auto">
        <Link href={`/admin/posts/${slug}/edit`} className={actionCls}>
          编辑
          <span className="sr-only">《{title}》</span>
        </Link>
        {viewable ? (
          <a href={postHref(slug)} target="_blank" rel="noreferrer" className={actionCls}>
            查看
            <span className="sr-only">《{title}》（新窗口打开）</span>
          </a>
        ) : (
          // 未上线的文章前台看不到，占位保持列对齐
          <span aria-hidden className={cn(actionCls, "invisible")}>
            查看
          </span>
        )}
        <ConfirmButton
          className={cn(actionCls, "cursor-pointer hover:text-accent-ink")}
          aria-label={`删除《${title}》`}
          title={`删除《${title}》？`}
          description="文章文件会被永久删除，无法恢复。它下面的评论会保留，但不再显示。"
          confirmLabel="删除文章"
          action={async () => {
            await deletePostAction(slug);
            setRemoved(true);
          }}
        >
          删除
        </ConfirmButton>
      </div>
    </li>
  );
}
