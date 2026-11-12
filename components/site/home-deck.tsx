"use client";

import { createContext, use, useMemo, useRef, useState } from "react";
import type { PostMeta } from "@/lib/types";
import { GlowScreen } from "@/components/ui/hardware";
import { entryNo, PostIndex } from "./post-index";

/** 旋钮每档 30°，-135°～135° 共 10 档：第 0 档为全部，其余按篇数取前 9 个分类 */
const STEP = 30;
const MAX_CATS = 9;

type Deck = {
  posts: PostMeta[];
  visible: PostMeta[];
  stops: string[];
  stop: number;
  setStop: (stop: number) => void;
  hover: string | null;
  setHover: (slug: string | null) => void;
};

const DeckContext = createContext<Deck | null>(null);

function useDeck(): Deck {
  const deck = use(DeckContext);
  if (!deck) throw new Error("首页面板组件必须放在 HomeDeckProvider 内");
  return deck;
}

/** 首页面板与目录的共享状态：旋钮档位（分类筛选）与当前指向的文章 */
export function HomeDeckProvider({ posts, children }: { posts: PostMeta[]; children: React.ReactNode }) {
  const [stop, setStop] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  const stops = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      const cat = p.tags[0];
      if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    const cats = [...counts].sort((a, b) => b[1] - a[1]).slice(0, MAX_CATS);
    return ["", ...cats.map(([cat]) => cat)];
  }, [posts]);

  const cat = stops[stop] ?? "";
  const visible = useMemo(() => (cat ? posts.filter((p) => p.tags[0] === cat) : posts), [posts, cat]);

  const deck = useMemo(
    () => ({ posts, visible, stops, stop: cat ? stop : 0, setStop, hover, setHover }),
    [posts, visible, stops, stop, cat, hover],
  );

  return <DeckContext value={deck}>{children}</DeckContext>;
}

/** 荧光屏：默认读总篇数；旋钮换档读该分类篇数；指向目录行时读那一篇的编号与阅读时长 */
export function DeckScreen({ online, entries }: { online: string; entries: string }) {
  const { posts, visible, stops, stop, hover } = useDeck();
  const index = hover ? posts.findIndex((p) => p.slug === hover) : -1;
  const post = index >= 0 ? posts[index] : undefined;
  const cat = stops[stop];

  const label = post ? `NO.${entryNo(index, posts.length)}` : cat ? `CAT / ${cat}` : online;
  const value = post ? post.readingTime : visible.length;
  const unit = post ? "MIN READ" : entries;

  return (
    <GlowScreen className="px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[0.625rem] tracking-[0.18em]">{label}</span>
        <span aria-hidden className="led led-green led-live shrink-0 scale-[0.85]" />
      </div>
      {/* key 随读数变化：重挂载以重播 lcd-refresh */}
      <p key={`${label}|${value}|${unit}`} className="lcd-refresh mt-1 text-[1.375rem] leading-none tracking-[0.1em] tabular-nums">
        {String(value).padStart(2, "0")}
        <span className="ml-1.5 text-[0.5625rem] tracking-[0.18em]">{unit}</span>
      </p>
    </GlowScreen>
  );
}

/** 旋钮：拖动或方向键换档，轻点进下一档 */
export function DeckKnob({ size = 44 }: { size?: number }) {
  const { stops, stop, setStop } = useDeck();
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const last = stops.length - 1;

  const stopAt = (e: React.PointerEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const deg = (Math.atan2(e.clientX - (r.left + r.width / 2), r.top + r.height / 2 - e.clientY) * 180) / Math.PI;
    return Math.min(last, Math.max(0, Math.round((deg + 135) / STEP)));
  };

  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label="按分类筛选目录"
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={stop}
      aria-valuetext={stops[stop] || "全部"}
      className="knob-ring knob-dial"
      style={{ ["--angle" as string]: `${stop * STEP - 135}deg` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
        d.moved = true;
        setStop(stopAt(e));
      }}
      onPointerUp={() => {
        if (drag.current && !drag.current.moved) setStop(stop >= last ? 0 : stop + 1);
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        const next =
          e.key === "ArrowRight" || e.key === "ArrowUp"
            ? Math.min(last, stop + 1)
            : e.key === "ArrowLeft" || e.key === "ArrowDown"
              ? Math.max(0, stop - 1)
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? last
                  : null;
        if (next === null) return;
        e.preventDefault();
        setStop(next);
      }}
    >
      <span aria-hidden className="knob" style={{ ["--knob" as string]: `${size}px` }} />
    </span>
  );
}

/** 首页目录：按旋钮档位筛选，并把指向的行报给荧光屏 */
export function HomePostIndex() {
  const { posts, visible, stops, stop, setStop, setHover } = useDeck();
  const cat = stops[stop];
  const point = (e: React.SyntheticEvent) =>
    setHover((e.target as Element).closest<HTMLElement>("[data-slug]")?.dataset.slug ?? null);
  // key 随档位变化：筛选后整组行重挂载，重播入场；悬停不会触发
  const list = useMemo(() => <PostIndex key={cat || "all"} posts={visible} all={posts} />, [visible, posts, cat]);

  return (
    <div
      onPointerOver={point}
      onPointerLeave={() => setHover(null)}
      onFocus={point}
      onBlur={() => setHover(null)}
    >
      {cat && (
        <p className="mono mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] tracking-[0.08em] text-muted uppercase">
          <span aria-hidden className="led led-signal shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            CAT / <span className="text-ink">{cat}</span> · {String(visible.length).padStart(2, "0")} / {String(posts.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => setStop(0)}
            className="mono cursor-pointer tracking-[0.08em] uppercase underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-ink hover:decoration-accent"
          >
            显示全部
          </button>
        </p>
      )}
      {list}
    </div>
  );
}
