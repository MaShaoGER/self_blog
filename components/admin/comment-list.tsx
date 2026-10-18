"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteCommentAction, setCommentStatusAction } from "@/app/admin/(shell)/comments/actions";
import type { CommentStatus } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ConfirmButton } from "./confirm-button";
import { LiveRegion, useAnnouncer } from "./live-region";

export type CommentItem = {
  id: string;
  author: string;
  website?: string;
  body: string;
  createdAt: string;
  createdText: string;
  status: CommentStatus;
  postTitle: string | null;
  postHref: string | null;
  postEditHref: string | null;
  postSlug: string;
};

const DONE_TEXT: Record<CommentStatus, string> = {
  approved: "已通过",
  hidden: "已隐藏",
  pending: "已移回待审核",
};

const btn =
  "inline-flex h-11 cursor-pointer items-center rounded-md px-3 text-[0.8125rem] transition-colors disabled:cursor-default disabled:opacity-50 md:h-9";

function safeUrl(u?: string) {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function Row({ item, onGone, announce }: { item: CommentItem; onGone: () => void; announce: (s: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const site = safeUrl(item.website);

  function move(status: CommentStatus) {
    setError(null);
    start(async () => {
      try {
        await setCommentStatusAction(item.id, status);
        announce(`${item.author} 的评论${DONE_TEXT[status]}`);
        onGone();
      } catch {
        setError("没能更新这条评论，请刷新后重试");
      }
    });
  }

  // 每个状态下给出另外两个去向
  const moves: { to: CommentStatus; label: string; primary?: boolean }[] =
    item.status === "pending"
      ? [
          { to: "approved", label: "通过", primary: true },
          { to: "hidden", label: "隐藏" },
        ]
      : item.status === "approved"
        ? [
            { to: "hidden", label: "隐藏" },
            { to: "pending", label: "移回待审核" },
          ]
        : [
            { to: "approved", label: "恢复显示", primary: true },
            { to: "pending", label: "移回待审核" },
          ];

  return (
    <li className={cn("py-4 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-[0.9375rem] font-medium text-ink">
          {site ? (
            <a href={site} target="_blank" rel="noreferrer nofollow ugc" className="link-underline">
              {item.author}
            </a>
          ) : (
            item.author
          )}
        </span>
        <time dateTime={item.createdAt} className="text-[0.8125rem] tabular-nums text-muted">
          {item.createdText}
        </time>
      </div>

      <p className="mt-1.5 max-w-[68ch] whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink-soft">
        {item.body}
      </p>

      <p className="mt-2 text-[0.8125rem] text-muted">
        评论于{" "}
        {item.postTitle ? (
          item.postHref ? (
            <a href={item.postHref} target="_blank" rel="noreferrer" className="link-underline text-ink-soft">
              《{item.postTitle}》
            </a>
          ) : (
            <>
              <Link href={item.postEditHref!} className="link-underline text-ink-soft">
                《{item.postTitle}》
              </Link>
              <span className="ml-1.5 text-faint">（未上线）</span>
            </>
          )
        ) : (
          <span className="text-faint">已删除的文章 /{item.postSlug}</span>
        )}
      </p>

      <div className="-ml-3 mt-2 flex flex-wrap items-center gap-1">
        {moves.map((m) => (
          <button
            key={m.to}
            type="button"
            disabled={pending}
            onClick={() => move(m.to)}
            className={cn(btn, m.primary ? "font-medium text-green hover:bg-surface-2" : "text-ink-soft hover:bg-surface-2")}
          >
            {m.label}
            <span className="sr-only">{item.author} 的评论</span>
          </button>
        ))}
        <ConfirmButton
          className={cn(btn, "text-muted hover:bg-surface-2 hover:text-accent-ink")}
          aria-label={`删除 ${item.author} 的评论`}
          title="删除这条评论？"
          description={
            <>
              {item.author} 的评论会被永久删除，无法恢复。只是不想公开的话，可以改用「隐藏」。
            </>
          }
          confirmLabel="删除评论"
          action={async () => {
            await deleteCommentAction(item.id);
            announce(`${item.author} 的评论已删除`);
            onGone();
          }}
        >
          删除
        </ConfirmButton>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[0.8125rem] text-accent-ink">
          {error}
        </p>
      )}
    </li>
  );
}

export function CommentList({ items, empty }: { items: CommentItem[]; empty: React.ReactNode }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const { message, announce } = useAnnouncer();
  const visible = items.filter((i) => !gone.has(i.id));

  return (
    <>
      <LiveRegion message={message} />
      {visible.length ? (
        <ul className="divide-y divide-line border-b border-line">
          {visible.map((item) => (
            <Row
              key={item.id}
              item={item}
              announce={announce}
              onGone={() => setGone((s) => new Set(s).add(item.id))}
            />
          ))}
        </ul>
      ) : (
        empty
      )}
    </>
  );
}
