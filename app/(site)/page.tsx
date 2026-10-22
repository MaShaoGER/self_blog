import Link from "next/link";
import { getLivePosts } from "@/lib/posts";
import { readProjects } from "@/lib/projects";
import { getSettings } from "@/lib/settings";
import { PostIndex } from "@/components/site/post-index";
import { Barcode, NoMark, Ruler } from "@/components/ui/marks";
import { GlowScreen, Knob, ScrewCorners, SilkStrip } from "@/components/ui/hardware";
import { dateParts } from "@/components/site/num-text";

export const dynamic = "force-dynamic";

/**
 * 首页 = 铭牌 + 目录。
 * 版式：站名铭牌（左）/ 状态块（右）→ 精选 → 目录参数表。
 */
export default async function HomePage() {
  const [posts, s, projects] = await Promise.all([getLivePosts(), getSettings(), readProjects()]);
  // 首页只露前三项；没有数据时整块不渲染。
  const projectTeaser = projects.slice(0, 3);
  const featured = posts.find((p) => p.featured);
  const latest = posts[0];
  const years = posts.length ? [...new Set(posts.map((p) => dateParts(p.date).year))].sort() : [];
  const span = years.length ? `${years[0]}–${years.at(-1)}` : "———";
  const lastUpdate = latest ? dateParts(latest.date) : null;
  const words = posts.reduce((n, p) => n + p.wordCount, 0);

  return (
    <div className="sheet">
      {/* 铭牌 */}
      <section
        aria-labelledby="masthead"
        className="wrap grid gap-y-9 border-b border-line-ink pt-10 pb-8 md:grid-cols-[minmax(0,1fr)_16rem] md:gap-x-12 lg:pt-14 lg:pb-10"
      >
        <div className="min-w-0">
          <div className="mono mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] tracking-[0.14em] text-muted uppercase">
            <NoMark prefix="EST." value="2026" className="text-faint" />
            <span aria-hidden className="text-faint">
              /
            </span>
            <span>ARCHIVE · NOTES · CODE</span>
          </div>

          <h1 id="masthead" className="display text-[clamp(2.75rem,10vw,6rem)] leading-[0.9]">
            {s.title}
          </h1>

          <p className="mono mt-3 text-[0.6875rem] tracking-[0.2em] text-accent uppercase">
            SELF_BLOG / {s.author}
          </p>

          <p className="mt-5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-ink-soft">{s.description}</p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={latest ? `/posts/${latest.slug}` : "/archive"} className="keybtn keybtn-safety">
              <span>阅读最新</span>
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/archive"
              className="mono text-[0.6875rem] tracking-[0.08em] text-muted uppercase underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-ink hover:decoration-accent"
            >
              全部 {String(posts.length).padStart(2, "0")} 篇
            </Link>
          </div>
        </div>

        {/* 状态块：金属面板 + 荧光屏。这是首页唯一的写实区域。 */}
        <aside className="min-w-0">
          <ScrewCorners className="metal p-4 pt-6 pb-5">
            <SilkStrip className="mb-3">STATUS / CTL-01</SilkStrip>

            <GlowScreen className="px-3 py-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.625rem] tracking-[0.18em]">SYS.ONLINE</span>
                <span aria-hidden className="led led-green scale-[0.85]" />
              </div>
              <p className="mt-1 text-[1.375rem] leading-none tracking-[0.1em] tabular-nums">
                {String(posts.length).padStart(2, "0")}
                <span className="ml-1.5 text-[0.5625rem] tracking-[0.18em]">ENTRIES</span>
              </p>
            </GlowScreen>

            <dl className="mt-3 space-y-1.5">
              {[
                { k: "ARCHIVE", v: span },
                { k: "WORDS", v: words.toLocaleString("en-US") },
                { k: "UPDATED", v: lastUpdate ? `${lastUpdate.year}.${lastUpdate.month}.${lastUpdate.day}` : "—" },
              ].map((row) => (
                <div key={row.k} className="flex items-baseline justify-between gap-3">
                  <dt className="mono text-[0.625rem] tracking-[0.12em] uppercase opacity-70">{row.k}</dt>
                  <dd className="mono text-[0.6875rem] tracking-[0.06em] tabular-nums">{row.v}</dd>
                </div>
              ))}
            </dl>

            {/* 旋钮：装饰性读数，作面板视觉重心 */}
            <div
              className="mt-4 flex items-center justify-between gap-3 border-t pt-3.5"
              style={{ borderColor: "var(--metal-line)" }}
            >
              <Knob angle={38} size={44} label="面板刻度，装饰性" />
              <div className="min-w-0 text-right">
                <span className="mono block text-[0.625rem] tracking-[0.16em] uppercase opacity-70">REV.02</span>
                <span className="mono block text-[0.625rem] tracking-[0.16em] uppercase opacity-50">SCALE 1:1</span>
              </div>
            </div>
          </ScrewCorners>

          <div className="mt-4">
            <Ruler className="text-line-strong" ticks={26} />
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="mono text-[0.625rem] tracking-[0.14em] text-faint uppercase">SERIAL</span>
              <Barcode value={`SELF_BLOG/${s.author}/${posts.length}`} className="h-6 w-24 text-ink/60" />
            </div>
          </div>
        </aside>
      </section>

      {/* 精选 */}
      {featured && (
        <section aria-labelledby="featured-title" className="wrap border-b border-line py-8 lg:py-10">
          <div className="grid gap-4 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-x-8">
            <div className="flex items-center gap-2 md:pt-1">
              <span aria-hidden className="led led-signal shrink-0" />
              <span id="featured-title" className="mono text-[0.625rem] leading-none tracking-[0.14em] text-signal uppercase">
                FEATURED
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="display text-[1.5rem] leading-tight md:text-[2rem]">
                <Link href={`/posts/${featured.slug}`} className="transition-colors hover:text-accent-ink">
                  {featured.title}
                </Link>
              </h2>
              {featured.excerpt && <p className="mt-2.5 max-w-[64ch] leading-relaxed text-muted">{featured.excerpt}</p>}
              <p className="mono mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] tracking-[0.08em] text-faint uppercase">
                <NoMark prefix="NO." value={posts.findIndex((p) => p.slug === featured.slug) + 1} className="text-muted" />
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {featured.date.slice(0, 4)}.{dateParts(featured.date).month}.{dateParts(featured.date).day}
                </span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{featured.readingTime} MIN READ</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 项目入口：一行参数表，不做卡片 */}
      {projectTeaser.length > 0 && (
        <section aria-labelledby="projects-teaser" className="wrap border-b border-line py-4 lg:py-5">
          <div className="grid gap-x-8 gap-y-2.5 md:grid-cols-[9rem_minmax(0,1fr)_auto] md:items-baseline">
            <h2 id="projects-teaser" className="mono text-[0.625rem] tracking-[0.14em] uppercase">
              <Link href="/projects" className="text-muted transition-colors hover:text-accent-ink">
                PROJECTS <span aria-hidden className="text-faint">/</span> 项目
              </Link>
            </h2>

            <ul className="flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1.5">
              {projectTeaser.map((p) => (
                <li key={`${p.title}-${p.year}`} className="flex min-w-0 items-baseline gap-1.5">
                  <span className="display min-w-0 truncate text-[0.9375rem] leading-none text-ink">{p.title}</span>
                  <span className="mono shrink-0 text-[0.625rem] tracking-[0.06em] text-faint tabular-nums">
                    {p.year}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/projects"
              className="mono shrink-0 justify-self-start text-[0.6875rem] tracking-[0.08em] text-muted uppercase underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-ink hover:decoration-accent md:justify-self-end"
            >
              全部 <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      )}

      {/* 目录 */}
      <section aria-labelledby="index-title" className="wrap py-10 lg:py-12">
        <div className="mb-6 flex items-end justify-between gap-6">
          <h2 id="index-title" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
            INDEX / 目录
          </h2>
          <span className="mono hidden text-[0.625rem] tracking-[0.08em] text-faint uppercase sm:block">
            NO. · TITLE · DATE · CAT · MIN
          </span>
        </div>

        {posts.length === 0 ? (
          <div className="border-t border-line-ink py-14">
            <p className="display text-[1.5rem] text-ink">NO RECORDS</p>
            <p className="mt-2 max-w-[52ch] text-muted">
              还没有发布的文章。第一篇正在写；也可以先订阅 RSS，发布时会收到。
            </p>
          </div>
        ) : (
          <PostIndex posts={posts} />
        )}
      </section>
    </div>
  );
}
