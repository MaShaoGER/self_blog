import { Ruler } from "@/components/ui/marks";

/**
 * 路由切换占位：保持档案语言的骨架，不做居中 spinner。
 * 形状有意做得像一张还没填写的参数表。
 */
export default function SiteLoading() {
  return (
    <div className="sheet" aria-busy="true" aria-live="polite">
      <span className="sr-only">正在读取档案</span>

      <div className="wrap pt-10 pb-8 lg:pt-14 lg:pb-10">
        <div className="mono flex items-baseline justify-between gap-6 border-b border-line-ink pb-2 text-[0.6875rem] tracking-[0.14em] text-faint uppercase">
          <span>LOADING</span>
          <span className="tabular-nums">ARCHIVE / ———</span>
        </div>

        <div className="mt-6 max-w-[36rem] space-y-3">
          <div className="h-9 w-[62%] bg-[color-mix(in_oklab,var(--ink)_9%,transparent)] sm:h-12" />
          <div className="h-4 w-[86%] bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]" />
          <div className="h-4 w-[54%] bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]" />
        </div>

        <Ruler className="mt-8 max-w-[36rem] text-line-strong" ticks={30} />
      </div>

      <div className="wrap pb-20">
        <div className="border-t border-line-ink">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-baseline gap-5 border-b border-line py-[1.125rem]">
              <span className="mono w-[4.5rem] shrink-0 text-[0.6875rem] tracking-[0.06em] text-faint tabular-nums">
                {String(i + 1).padStart(3, "0")}
              </span>
              <span
                className="h-4 bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]"
                style={{ width: `${52 - i * 7}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
