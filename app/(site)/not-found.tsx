import Link from "next/link";
import { NoMark, Ruler } from "@/components/ui/marks";

/** 404 = 无此卷宗。左 404 大字作为档案编号，右侧给回查路径。 */
export default function NotFound() {
  const routes = [
    { href: "/", label: "首页", no: "01" },
    { href: "/archive", label: "归档", no: "02" },
    { href: "/series", label: "系列", no: "03" },
    { href: "/projects", label: "项目", no: "04" },
    { href: "/search", label: "搜索", no: "05" },
  ];

  return (
    <div className="sheet">
      <div className="wrap grid gap-y-8 border-b border-line-ink pt-12 pb-10 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-x-12 lg:grid-cols-[20rem_minmax(0,1fr)] lg:pt-16">
        <div className="flex flex-col gap-5">
          <div>
            <p className="mono text-[0.625rem] tracking-[0.14em] text-muted uppercase">
              ERROR <span aria-hidden className="text-faint">/</span> 404
            </p>
            <p aria-hidden className="display mt-3 text-[clamp(4rem,14vw,7rem)] text-faint leading-none">
              404
            </p>
            <p className="mono mt-2 text-[0.6875rem] tracking-[0.12em] text-muted uppercase">NO ROUTE</p>
          </div>
          <Ruler className="text-line-strong" ticks={20} />
          <p className="mono text-[0.625rem] tracking-[0.1em] text-faint uppercase">
            <NoMark prefix="REF." value="SELF_BLOG/404" />
          </p>
        </div>

        <div className="border-t border-line-ink pt-6 md:border-t-0 md:border-l md:border-l-line-strong md:pt-0 md:pl-10 lg:pl-12">
          <h1 className="display text-[clamp(1.75rem,4vw,2.5rem)]">这一页不存在</h1>
          <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-soft">
            请求的地址没有对应的卷宗：链接可能写错了，或者这篇文章已经撤下。
          </p>

          <div className="mt-8">
            <p className="label text-faint">可用入口 / ROUTES</p>
            <ul className="mt-3 flex flex-col border-t border-line">
              {routes.map((r) => (
                <li key={r.href} className="border-b border-line">
                  <Link
                    href={r.href}
                    className="group flex items-baseline gap-4 py-3 transition-colors hover:text-accent-ink"
                  >
                    <span className="mono w-6 shrink-0 text-[0.625rem] tracking-[0.06em] text-faint tabular-nums">
                      {r.no}
                    </span>
                    <span className="text-[0.9375rem] text-ink transition-colors group-hover:text-accent-ink">
                      {r.label}
                    </span>
                    <span
                      aria-hidden
                      className="mono ml-auto text-[0.875rem] text-faint transition-transform duration-150 group-hover:translate-x-1 group-hover:text-accent"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
