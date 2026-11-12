"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type TocItem = { depth: 2 | 3; text: string; id: string };

/**
 * 章节号只分配给 h2，和正文 h2 的自动编号（01 / 02）严格对齐；
 * h3 不编号，只做缩进，避免目录编号与正文编号错位。
 */
function sectionNumbers(items: TocItem[]): (string | null)[] {
  let n = 0;
  return items.map((h) => {
    if (h.depth !== 2) return null;
    n += 1;
    return String(n).padStart(2, "0");
  });
}

function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const visible = new Set<string>();

    const pick = () => {
      // 取视口内最靠上的标题；都不在视口内时保留最后一个已滚过的标题。
      const first = els.find((el) => visible.has(el.id));
      if (first) return setActive(first.id);
      const above = els.filter((el) => el.getBoundingClientRect().top < 0).at(-1);
      setActive(above?.id ?? null);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        pick();
      },
      { rootMargin: "-72px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);

  return active;
}

/** 点击目录后让目标标题闪一下（编号放大回位、文字短暂转橙），--dur-3 内结束。 */
function flashHeading(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("reading-flash");
  const done = () => el.classList.remove("reading-flash");
  el.addEventListener("animationend", done, { once: true });
  window.setTimeout(done, 800);
}

function TocList({
  items,
  active,
  onNavigate,
  track,
}: {
  items: TocItem[];
  active: string | null;
  onNavigate?: () => void;
  /** 桌面目录：只用一个共享标记滑到当前条目 */
  track?: boolean;
}) {
  const numbers = sectionNumbers(items);
  const listRef = useRef<HTMLOListElement>(null);
  const dots = useRef(new Map<string, HTMLSpanElement | null>());
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!track) return;
    const measure = () => {
      const list = listRef.current;
      const dot = active ? dots.current.get(active) : null;
      if (!list || !dot) {
        setPos(null);
        return;
      }
      const l = list.getBoundingClientRect();
      const d = dot.getBoundingClientRect();
      setPos({ x: d.left - l.left, y: d.top - l.top });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, track, items]);

  // 首次定位不放过渡，避免标记从列表顶角飞入
  useEffect(() => {
    if (!pos || armed) return;
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, [pos, armed]);

  return (
    <ol ref={listRef} className="relative">
      {track && (
        <span
          aria-hidden
          data-armed={armed}
          className="reading-toc-marker pointer-events-none absolute top-0 left-0 size-1.5 rounded-full bg-accent"
          style={{ transform: `translate(${pos?.x ?? 0}px, ${pos?.y ?? 0}px)`, opacity: pos ? 1 : 0 }}
        />
      )}
      {items.map((h, i) => {
        const on = h.id === active;
        return (
          <li key={h.id} className="border-b border-line last:border-b-0">
            <a
              href={`#${h.id}`}
              onClick={() => {
                flashHeading(h.id);
                onNavigate?.();
              }}
              aria-current={on ? "location" : undefined}
              className={cn(
                "group flex items-baseline gap-2 py-1.5 transition-colors",
                h.depth === 3 && "pl-6",
                on ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mono w-5 shrink-0 text-[0.6875rem] tracking-[0.04em] tabular-nums",
                  on ? "text-accent" : "text-faint",
                )}
              >
                {numbers[i] ?? "·"}
              </span>
              <span className="min-w-0 flex-1 text-[0.875rem] leading-snug">{h.text}</span>
              <span
                aria-hidden
                ref={(el) => {
                  dots.current.set(h.id, el);
                }}
                className="mt-[0.4em] size-1.5 shrink-0 rounded-full"
              />
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/** 桌面左栏目录：编号 + 单个橙色标记滑到当前项。 */
export function Toc({ items, className }: { items: TocItem[]; className?: string }) {
  const [ids] = useState(() => items.map((i) => i.id));
  const active = useActiveHeading(ids);
  const count = items.filter((i) => i.depth === 2).length;

  return (
    <nav aria-labelledby="toc-title" className={className}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line-ink pb-2">
        <h2 id="toc-title" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
          CONTENTS
          <span aria-hidden className="mx-1.5 text-faint">
            /
          </span>
          目录
        </h2>
        <span className="mono text-[0.6875rem] tracking-[0.08em] text-faint tabular-nums">
          {String(count).padStart(2, "0")}
        </span>
      </div>
      <TocList items={items} active={active} track />
    </nav>
  );
}

/** 移动端目录：正文上方折叠，展开后同样带编号。 */
export function TocMobile({ items, className }: { items: TocItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const count = items.filter((i) => i.depth === 2).length;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className={cn("toc-details border-t border-line-ink", className)}
    >
      <summary className="flex items-baseline justify-between gap-3 py-2.5">
        <span className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
          CONTENTS
          <span aria-hidden className="mx-1.5 text-faint">
            /
          </span>
          目录
        </span>
        <span className="mono flex items-baseline gap-2 text-[0.6875rem] tracking-[0.08em] text-faint tabular-nums">
          {String(count).padStart(2, "0")} SEC.
          <svg aria-hidden viewBox="0 0 16 16" className="toc-caret size-3 self-center transition-transform">
            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
      </summary>
      <div className="pb-2">
        <TocList items={items} active={null} onNavigate={() => setOpen(false)} />
      </div>
    </details>
  );
}
