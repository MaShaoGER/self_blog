import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getLivePosts } from "@/lib/posts";
import { Markdown } from "@/components/ui/markdown";
import { Barcode, NoMark, Ruler, StatusLine } from "@/components/ui/marks";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "关于" };

/** 关于页 = 铭牌：左简介 + 右规格表，底部站点参数表。 */
export default async function AboutPage() {
  const [s, posts] = await Promise.all([getSettings(), getLivePosts()]);

  const links = [
    s.email && { href: `mailto:${s.email}`, label: "EMAIL", value: s.email },
    s.github && {
      href: /^https?:\/\//.test(s.github) ? s.github : `https://github.com/${s.github}`,
      label: "GITHUB",
      value: s.github.replace(/^https?:\/\/(www\.)?github\.com\//, ""),
    },
    s.x && {
      href: /^https?:\/\//.test(s.x) ? s.x : `https://x.com/${s.x.replace(/^@/, "")}`,
      label: "X",
      value: s.x.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, "").replace(/^/, "@"),
    },
  ].filter(Boolean) as { href: string; label: string; value: string }[];

  const years = posts.length ? [...new Set(posts.map((p) => p.date.slice(0, 4)))].sort() : [];
  const words = posts.reduce((n, p) => n + p.wordCount, 0);

  const specs: { k: string; v: string }[] = [
    { k: "AUTHOR", v: s.author },
    { k: "ENTRIES", v: String(posts.length).padStart(2, "0") },
    { k: "SPAN", v: years.length ? `${years[0]}–${years.at(-1)}` : "———" },
    { k: "WORDS", v: words.toLocaleString("en-US") },
    { k: "COMMENTS", v: s.commentsAutoApprove ? "AUTO" : "MODERATED" },
  ];

  return (
    <div className="sheet">
      <div className="wrap pt-10 pb-16 lg:pt-14 lg:pb-20">
        {/* 页头 */}
        <div className="mono flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line-ink pb-2 text-[0.6875rem] tracking-[0.14em] uppercase">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <NoMark prefix="DOC." value="ABOUT" className="text-ink" />
            <span aria-hidden className="text-faint">
              /
            </span>
            <span className="text-muted">STATION PLATE</span>
          </span>
          <span className="text-muted tabular-nums">REV.02</span>
        </div>

        <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-x-14">
          {/* 左：简介 */}
          <div className="min-w-0 self-stretch">
            <div className="flex items-baseline gap-4">
              {s.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.avatar}
                  alt={s.author}
                  width={72}
                  height={72}
                  className="size-16 shrink-0 border border-line-ink object-cover grayscale"
                />
              )}
              <div className="min-w-0">
                <h1 className="display text-[clamp(2rem,5vw,3.25rem)] leading-[0.95]">关于</h1>
                <p className="mono mt-2 text-[0.6875rem] tracking-[0.14em] text-accent uppercase">
                  {s.author} / {s.title}
                </p>
              </div>
            </div>

            <div className="mt-8 max-w-[64ch]">
              <Markdown source={s.aboutMarkdown} />
            </div>

            {links.length > 0 && (
              <dl className="mt-12 max-w-[64ch] border-t border-line-ink">
                {links.map((l) => (
                  <div key={l.label} className="flex items-baseline gap-6 border-b border-line py-3">
                    <dt className="mono w-20 shrink-0 text-[0.625rem] tracking-[0.14em] text-faint">{l.label}</dt>
                    <dd className="min-w-0 truncate">
                      <a
                        href={l.href}
                        className="link-underline text-[0.9375rem] text-ink"
                        {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer me" } : {})}
                      >
                        {l.value}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* 右：规格表 */}
          <aside aria-label="站点规格" className="min-w-0">
            <div className="border-t border-line-ink pt-3">
              <p className="mono mb-2 text-[0.6875rem] tracking-[0.18em] text-faint uppercase">SPEC</p>
              <dl>
                {specs.map((row) => (
                  <div key={row.k} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                    <dt className="mono text-[0.625rem] tracking-[0.12em] text-faint uppercase">{row.k}</dt>
                    <dd className="mono truncate text-[0.6875rem] tracking-[0.06em] text-ink tabular-nums">{row.v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-8">
              <StatusLine status="online">SYS.ONLINE</StatusLine>
              <Ruler className="mt-3 text-line-strong" ticks={22} />
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">SCALE 1:1</span>
                <Barcode value={`ABOUT/${s.author}/${s.title}`} className="h-6 w-20 text-ink/60" />
              </div>
            </div>
          </aside>
        </div>

        {/* 底部：一句话出口（站点参数表由全站页脚统一承担，此处不重复） */}
        <p className="mono mt-14 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-ink pt-5 text-[0.625rem] tracking-[0.14em] text-faint uppercase">
          <Link href="/archive" className="hover:text-accent-ink">
            查看全部文章
          </Link>
          <span aria-hidden>/</span>
          <Link href="/" className="hover:text-accent-ink">
            返回首页
          </Link>
          <span aria-hidden>/</span>
          <a href="/feed.xml" className="hover:text-accent-ink">
            RSS
          </a>
        </p>
      </div>
    </div>
  );
}
