import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApprovedComments } from "@/lib/comments";
import { siteUrl } from "@/lib/env";
import { extractHeadings } from "@/lib/headings";
import { formatDateShort } from "@/lib/format";
import { getLivePost, getLivePosts, getRelatedPosts, getSeries } from "@/lib/posts";
import { Markdown } from "@/components/ui/markdown";
import { FigCaption, NoMark } from "@/components/ui/marks";
import { CommentForm } from "@/components/site/comment-form";
import { CommentList } from "@/components/site/comment-list";
import { entryNo, MetaStrip, postCat, revNo, RevisionLog, SpecSheet } from "@/components/site/post-params";
import { ReadingProgress } from "@/components/site/reading-progress";
import { RelatedPosts } from "@/components/site/related-posts";
import { SeriesStrip } from "@/components/site/series-strip";
import { Toc, TocMobile } from "@/components/site/toc";
import { submitComment } from "./comment-actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getLivePost(slug);
  if (!post) return { title: "文章不存在" };
  const url = `${siteUrl()}/posts/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
      modifiedTime: post.updated,
      tags: post.tags,
      images: post.cover ? [{ url: post.cover }] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getLivePost(slug);
  if (!post) notFound();

  const [all, comments, series, related] = await Promise.all([
    getLivePosts(),
    getApprovedComments(post.slug),
    post.series ? getSeries(post.series) : Promise.resolve(null),
    getRelatedPosts(post.slug, 3),
  ]);
  const i = all.findIndex((p) => p.slug === post.slug);
  // 列表按时间倒序：older 是下一篇（更早），newer 是上一篇（更新）
  const older = i >= 0 ? all[i + 1] : undefined;
  const newer = i > 0 ? all[i - 1] : undefined;

  const headings = extractHeadings(post.content);
  const showToc = headings.length >= 3;
  const action = submitComment.bind(null, post.slug);

  const total = all.length;
  const no = entryNo(i >= 0 ? i : total - 1, total);
  const cat = postCat(post);
  const rev = revNo(post.date, post.updated);

  return (
    <article className="wrap pt-8 pb-20 lg:pt-12 lg:pb-28">
      {/* 页头：编号 / 分类 / 修订 → 标题 → 副标题 */}
      <header className="max-w-[52rem]">
        <div className="mono flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line-ink pb-2 text-[0.6875rem] tracking-[0.14em] uppercase">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <NoMark prefix="NO." value={no} />
            {cat && (
              <>
                <span aria-hidden className="text-faint">
                  /
                </span>
                <span className="text-muted">
                  CAT.<span className="text-ink">{cat}</span>
                </span>
              </>
            )}
          </span>
          <span className="text-faint tabular-nums">
            REV.<span className="text-muted">{rev}</span>
          </span>
        </div>

        <h1 className="display mt-5 text-[clamp(2rem,5.4vw,3.5rem)] leading-[0.98] text-ink">{post.title}</h1>

        {post.excerpt && (
          <p className="mt-4 max-w-[52ch] text-[1.0625rem] leading-relaxed text-ink-soft">{post.excerpt}</p>
        )}

        {/* 系列条：只有属于系列的文章才有 */}
        {post.series && series && (
          <SeriesStrip name={series.name} posts={series.posts} current={post.slug} className="mt-7" />
        )}

        {/* 移动端：标题下参数块；桌面由左栏 SPEC 取代 */}
        <MetaStrip post={post} className="mt-6 lg:hidden" />
      </header>

      <div className="mt-8 flex flex-col gap-y-8 lg:mt-12 lg:flex-row lg:items-start lg:gap-x-12 xl:gap-x-16">
        {/* 桌面左栏：参数表，避开含 tagline 的站头（实测约 96px） */}
        <aside className="hidden lg:block lg:w-48 lg:shrink-0">
          <div className="sticky top-[6.5rem] pb-10">
            <p className="mono mb-2 text-[0.6875rem] tracking-[0.18em] text-faint uppercase">SPEC</p>
            <SpecSheet post={post} />
          </div>
        </aside>

        <div className="mx-auto min-w-0 w-full xl:mx-0" style={{ maxWidth: "624px" }}>
          {/* 阅读进度：有目录时宽屏放右栏（见下方 aside），窄屏放正文上方；
              无目录的短文右栏不渲染，因此这里常驻一条，保证任何宽度都有读数 */}
          {showToc ? (
            <ReadingProgress className="mb-3 xl:hidden" />
          ) : (
            <ReadingProgress className="mb-4" />
          )}

          {showToc && <TocMobile items={headings} className="mb-2 xl:hidden" />}

          {post.cover && (
            <figure className="mt-6 mb-10 lg:mt-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.cover}
                alt=""
                className="aspect-[4/3] w-full border border-line-ink object-cover"
                fetchPriority="high"
              />
              <FigCaption no="01">封面 / {formatDateShort(post.date)}</FigCaption>
            </figure>
          )}

          <Markdown source={post.content} />

          <RevisionLog post={post} className="mt-16" />

          {(older || newer) && (
            <nav aria-label="相邻文章" className="mt-6">
              <div className="mono flex items-baseline justify-between gap-4 border-b border-line-ink pb-2 text-[0.6875rem] tracking-[0.14em] text-faint uppercase">
                <span>ADJACENT</span>
                <span>PREV / NEXT</span>
              </div>
              <div className="grid sm:grid-cols-2">
                {older ? (
                  <Link
                    href={`/posts/${older.slug}`}
                    rel="prev"
                    className="group border-b border-line py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] sm:border-b-0 sm:pr-6"
                  >
                    <span className="mono flex items-baseline gap-2 text-[0.6875rem] tracking-[0.14em] text-faint uppercase">
                      <span className="text-accent-ink">PREV</span>
                      <NoMark prefix="NO." value={entryNo(i + 1, total)} />
                    </span>
                    <span className="display mt-1.5 block text-[0.9375rem] leading-snug text-ink transition-colors group-hover:text-accent-ink">
                      {older.title}
                    </span>
                  </Link>
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
                {newer && (
                  <Link
                    href={`/posts/${newer.slug}`}
                    rel="next"
                    className="group border-b border-line py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] sm:border-b-0 sm:border-l sm:pl-6 sm:text-right"
                  >
                    <span className="mono flex items-baseline gap-2 text-[0.6875rem] tracking-[0.14em] text-faint uppercase sm:justify-end">
                      <span className="text-accent-ink">NEXT</span>
                      <NoMark prefix="NO." value={entryNo(i - 1, total)} />
                    </span>
                    <span className="display mt-1.5 block text-[0.9375rem] leading-snug text-ink transition-colors group-hover:text-accent-ink">
                      {newer.title}
                    </span>
                  </Link>
                )}
              </div>
            </nav>
          )}

          <RelatedPosts posts={related} className="mt-16" />

          <section id="comments" aria-labelledby="comments-title" className="mt-16 scroll-mt-24">
            <div className="flex items-baseline justify-between gap-4 border-b border-line-ink pb-2">
              <h2 id="comments-title" className="mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">
                COMMENTS
                <span aria-hidden className="mx-2 text-faint">
                  /
                </span>
                评论
              </h2>
              <span className="mono text-[0.6875rem] tracking-[0.08em] text-faint tabular-nums">
                {String(comments.length).padStart(2, "0")}
              </span>
            </div>
            <CommentList comments={comments} className="mt-1" />
            <CommentForm action={action} className="mt-10" />
          </section>
        </div>

        {/* 右栏：阅读进度 + 目录。三栏在 1024–1279 放不下（正文 624 + SPEC 192 已占满），
            该区间改用正文上方的折叠目录，xl 起才展开为常驻侧栏。
            self-stretch 让 sticky 能在整行高度内跟随；站头含 tagline 实际约 96px，top-[6.5rem] 留呼吸位 */}
        {showToc && (
          <aside className="hidden xl:block xl:min-w-0 xl:flex-1 xl:self-stretch">
            <div className="sticky top-[6.5rem] max-h-[calc(100dvh-8.5rem)] overflow-y-auto pb-10">
              <ReadingProgress className="mb-5" />
              <Toc items={headings} />
            </div>
          </aside>
        )}
      </div>
    </article>
  );
}

