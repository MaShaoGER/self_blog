import Link from "next/link";
import { Barcode } from "@/components/ui/marks";
import { NAV_DESTINATIONS, type SiteNavigation, type SiteFooterSettings } from "@/shared/site-chrome";

/**
 * 页脚：规格表式。左站点参数（搭建 / 栈 / 更新 / 订阅），右条码 + 版权。
 * 视觉上是一条收口的墨线 + mono 参数，不做营销区块。
 */
export function SiteFooter({ title, author, navigation, footer }: { title: string; author: string; navigation: SiteNavigation; footer: SiteFooterSettings }) {
  const year = new Date().getFullYear();
  const specs = [
    { k: footer.buildLabel, v: footer.buildValue },
    { k: footer.contentLabel, v: footer.contentValue },
    { k: footer.rssLabel, v: footer.rssValue },
    { k: footer.revisionLabel, v: `© ${year}` },
  ];

  return (
    <footer className="no-print mt-auto border-t border-line-ink">
      <div className="wrap">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 py-8 sm:grid-cols-4">
          {specs.map((s, index) => (
            <div key={index} className="min-w-0">
              <dt className="label break-words text-faint">{s.k}</dt>
              <dd className="mono mt-1.5 break-words text-[0.6875rem] tracking-[0.06em] text-ink">{s.v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-4 border-t border-line py-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="display break-words text-[0.9375rem] leading-none">{title}</span>
              <span className="mono break-all text-[0.625rem] tracking-[0.14em] text-faint uppercase">{author} / {footer.brandPrefix}</span>
            </div>
            {footer.description && <p className="mt-3 max-w-prose break-words text-[0.8125rem] leading-relaxed text-muted">{footer.description}</p>}
          </div>

          <div className="flex min-w-0 items-end gap-6">
            <nav aria-label="页脚导航" className="flex flex-wrap gap-x-4 gap-y-3">
              {NAV_DESTINATIONS.map(({ key, href }) => <Link key={key} href={href} className="mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase hover:text-accent-ink">{navigation[key].label}</Link>)}
              <a href="/feed.xml" className="mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase hover:text-accent-ink">
                {footer.subscriptionLabel}
              </a>
              <Link href="/login" className="mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase hover:text-accent-ink">
                {footer.manageLabel}
              </Link>
            </nav>
            <Barcode value={`${footer.brandPrefix}/${year}/${author}`} className="hidden h-6 w-40 shrink-0 text-ink/70 xl:block" />
          </div>
        </div>
      </div>
    </footer>
  );
}
