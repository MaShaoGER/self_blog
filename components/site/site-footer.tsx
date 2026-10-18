import Link from "next/link";
import { Barcode } from "@/components/ui/marks";

/**
 * 页脚：规格表式。左站点参数（搭建 / 栈 / 更新 / 订阅），右条码 + 版权。
 * 视觉上是一条收口的墨线 + mono 参数，不做营销区块。
 */
export function SiteFooter({ title, author }: { title: string; author: string }) {
  const year = new Date().getFullYear();
  const specs = [
    { k: "BUILD", v: "NEXT 16 / REACT 19" },
    { k: "CONTENT", v: "MARKDOWN FILES" },
    { k: "RSS", v: "FEED.XML" },
    { k: "REV", v: `© ${year}` },
  ];

  return (
    <footer className="no-print mt-auto border-t border-line-ink">
      <div className="wrap">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 py-8 sm:grid-cols-4">
          {specs.map((s) => (
            <div key={s.k}>
              <dt className="label text-faint">{s.k}</dt>
              <dd className="mono mt-1.5 text-[0.6875rem] tracking-[0.06em] text-ink">{s.v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-4 border-t border-line py-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-baseline gap-3">
            <span className="display text-[0.9375rem] leading-none">{title}</span>
            <span className="mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">
              {author} / SELF_BLOG
            </span>
          </div>

          <div className="flex items-end gap-6">
            <nav aria-label="页脚导航" className="flex gap-4">
              <Link href="/archive" className="mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase hover:text-accent-ink">
                全部
              </Link>
              <a href="/feed.xml" className="mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase hover:text-accent-ink">
                RSS
              </a>
              <Link href="/login" className="mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase hover:text-accent-ink">
                管理
              </Link>
            </nav>
            <Barcode value={`SELF_BLOG/${year}/${author}`} className="hidden h-6 w-40 text-ink/70 sm:block" />
          </div>
        </div>
      </div>
    </footer>
  );
}
